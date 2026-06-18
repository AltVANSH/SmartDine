const Order = require('../models/Order');
const TableSession = require('../models/TableSession');
const Table = require('../models/Table');
const QueueEntry = require('../models/QueueEntry');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Helper to find the latest active table session for a user
const findActiveSession = async (userId) => {
  return await TableSession.findOne({
    status: { $ne: 'completed' },
    $or: [{ hostId: userId }, { participants: userId }]
  }).sort({ createdAt: -1 }); // Rule 7: Always sort by createdAt: -1
};

// Helper to try seating the next queue entry for a freed table
const trySeatingNextInQueue = async (table, io) => {
  // Find the oldest 'waiting' queue entry that fits this table
  const nextInQueue = await QueueEntry.findOne({
    status: 'waiting',
    partySize: { $lte: table.capacity }
  }).sort({ joinedAt: 1 });

  if (!nextInQueue) {
    // No one waiting, simply mark table as available
    table.status = 'available';
    await table.save();
    console.log(`Table ${table.tableNumber} is now available.`);
    return;
  }

  // Seat the next guest from queue
  const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  const estimatedEndTime = new Date();
  estimatedEndTime.setMinutes(estimatedEndTime.getMinutes() + 60);

  const newSession = await TableSession.create({
    tableNumber: table.tableNumber,
    hotelName: table.hotelName,
    hostId: nextInQueue.hostId,
    participants: [nextInQueue.hostId],
    joinCode,
    estimatedEndTime
  });

  // Update the table to occupied
  table.status = 'occupied';
  await table.save();

  // Mark the queue entry as seated
  nextInQueue.status = 'seated';
  nextInQueue.allocatedTableNumber = table.tableNumber;
  nextInQueue.targetTableId = table._id;
  await nextInQueue.save();

  // Notify the newly seated user via socket
  io.emit('queue_seated', {
    userId: nextInQueue.hostId.toString(),
    session: newSession
  });

  console.log(`Queue guest ${nextInQueue.hostId} seated at Table ${table.tableNumber}.`);
};

// @desc    Get the full consolidated bill for the current session
// @route   GET /api/payment/bill
// @access  Private
const getBill = async (req, res) => {
  try {
    const userId = req.user._id;
    const session = await findActiveSession(userId);

    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    // Fetch all orders for this session, with addedBy user info
    const orders = await Order.find({ sessionId: session._id })
      .populate('items.addedBy', 'name email');

    if (!orders || orders.length === 0) {
      return res.status(400).json({ message: 'No orders found for this session.' });
    }

    // Build the consolidated bill
    const subtotal = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const tax = parseFloat((subtotal * 0.1).toFixed(2)); // 10% tax
    
    // Tip is based on the selected percentage of the subtotal
    const tipPercentage = session.tipPercentage || 0;
    const tipAmount = parseFloat((subtotal * (tipPercentage / 100)).toFixed(2));
    
    const grandTotal = parseFloat((subtotal + tax + tipAmount).toFixed(2));

    // Build per-user itemized breakdown for "Pay by Item" split
    const itemizedByUser = {};
    for (const order of orders) {
      for (const item of order.items) {
        const addedById = item.addedBy?._id?.toString() || item.addedBy?.toString();
        const addedByName = item.addedBy?.name || 'Unknown';

        if (!addedById) continue;

        if (!itemizedByUser[addedById]) {
          itemizedByUser[addedById] = {
            userId: addedById,
            name: addedByName,
            items: [],
            subtotal: 0
          };
        }

        const lineTotal = parseFloat((item.price * item.quantity).toFixed(2));
        itemizedByUser[addedById].items.push({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          lineTotal
        });
        itemizedByUser[addedById].subtotal = parseFloat(
          (itemizedByUser[addedById].subtotal + lineTotal).toFixed(2)
        );
      }
    }

    // Add tax and tip proportionally to each user's share
    for (const uid of Object.keys(itemizedByUser)) {
      const share = itemizedByUser[uid].subtotal;
      const proportionalTax = subtotal > 0 ? parseFloat(((share / subtotal) * tax).toFixed(2)) : 0;
      const proportionalTip = subtotal > 0 ? parseFloat(((share / subtotal) * tipAmount).toFixed(2)) : 0;
      
      itemizedByUser[uid].taxShare = proportionalTax;
      itemizedByUser[uid].tipShare = proportionalTip;
      itemizedByUser[uid].total = parseFloat((share + proportionalTax + proportionalTip).toFixed(2));
    }

    // "Split Evenly" calculation
    const participantCount = session.participants.length || 1;
    const splitEvenlyPerHead = parseFloat((grandTotal / participantCount).toFixed(2));

    res.status(200).json({
      sessionId: session._id.toString(),
      tableNumber: session.tableNumber,
      paymentSplitMethod: session.paymentSplitMethod,
      tipPercentage: session.tipPercentage,
      paymentBreakdown: session.paymentBreakdown || {},
      orders,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax,
      tipAmount,
      grandTotal,
      participantCount,
      splitEvenlyPerHead,
      itemizedByUser
    });
  } catch (error) {
    console.error('Error fetching bill:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Host selects the payment split method for the session
// @route   POST /api/payment/method
// @access  Private (Host only)
const setSplitMethod = async (req, res) => {
  try {
    const io = req.app.get('io');
    const userId = req.user._id;
    const { method } = req.body;

    const validMethods = ['single_payer', 'split_evenly', 'itemized'];
    if (!method || !validMethods.includes(method)) {
      return res.status(400).json({ message: `Invalid split method. Must be one of: ${validMethods.join(', ')}` });
    }

    const session = await findActiveSession(userId);
    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    // Only the host can set the split method
    if (session.hostId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the host can select the payment method.' });
    }

    session.paymentSplitMethod = method;
    session.status = 'paying';
    await session.save();

    const sessionIdStr = session._id.toString();

    // Rule 4: Emit before returning response — notify all guests at the table
    io.to(`table_room_${sessionIdStr}`).emit('checkout_initiated', {
      sessionId: sessionIdStr,
      method,
      initiatedBy: userId.toString()
    });

    res.status(200).json({
      message: `Split method set to "${method}".`,
      method,
      sessionId: sessionIdStr
    });
  } catch (error) {
    console.error('Error setting split method:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Host sets the tip percentage for the session
// @route   POST /api/payment/tip
// @access  Private (Host only)
const setTip = async (req, res) => {
  try {
    const io = req.app.get('io');
    const userId = req.user._id;
    const { percentage } = req.body;

    const session = await findActiveSession(userId);
    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    if (session.hostId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the host can set the tip.' });
    }

    session.tipPercentage = Number(percentage) || 0;
    await session.save();

    const sessionIdStr = session._id.toString();

    // Notify all guests that tip was updated so they can fetch the updated bill
    io.to(`table_room_${sessionIdStr}`).emit('tip_updated', {
      tipPercentage: session.tipPercentage
    });

    res.status(200).json({ message: 'Tip updated successfully.', tipPercentage: session.tipPercentage });
  } catch (error) {
    console.error('Error setting tip:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a Stripe PaymentIntent for the user's specific share
// @route   POST /api/payment/create-payment-intent
// @access  Private
const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user._id;
    const session = await findActiveSession(userId);
    
    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    if (session.status !== 'paying') {
      return res.status(400).json({ message: 'Checkout has not been initiated yet.' });
    }

    // Recalculate bill to find this user's specific share amount
    const orders = await Order.find({ sessionId: session._id });
    const subtotal = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const tax = parseFloat((subtotal * 0.1).toFixed(2));
    const tipAmount = parseFloat((subtotal * (session.tipPercentage / 100)).toFixed(2));
    const grandTotal = parseFloat((subtotal + tax + tipAmount).toFixed(2));

    let myShareAmount = 0;
    
    if (session.paymentSplitMethod === 'split_evenly') {
      const participantCount = session.participants.length || 1;
      myShareAmount = parseFloat((grandTotal / participantCount).toFixed(2));
    } else if (session.paymentSplitMethod === 'single_payer') {
      if (session.hostId.toString() === userId.toString()) {
        myShareAmount = grandTotal;
      } else {
        myShareAmount = 0; // Guests pay nothing
      }
    } else if (session.paymentSplitMethod === 'itemized') {
      let mySubtotal = 0;
      for (const order of orders) {
        for (const item of order.items) {
          if (item.addedBy?.toString() === userId.toString()) {
            mySubtotal += (item.price * item.quantity);
          }
        }
      }
      const myTax = subtotal > 0 ? (mySubtotal / subtotal) * tax : 0;
      const myTip = subtotal > 0 ? (mySubtotal / subtotal) * tipAmount : 0;
      myShareAmount = parseFloat((mySubtotal + myTax + myTip).toFixed(2));
    }

    if (myShareAmount <= 0) {
      return res.status(400).json({ message: 'No payment required.' });
    }

    // Create a PaymentIntent with the order amount in cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(myShareAmount * 100),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        sessionId: session._id.toString(),
        userId: userId.toString()
      }
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
      amount: myShareAmount
    });
  } catch (error) {
    console.error('Error creating payment intent:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    A user pays their share (mock payment)
// @route   POST /api/payment/pay
// @access  Private
const payShare = async (req, res) => {
  try {
    const io = req.app.get('io');
    const userId = req.user._id;
    const userIdStr = userId.toString();

    const session = await findActiveSession(userId);
    if (!session) {
      return res.status(404).json({ message: 'No active session to pay for.' });
    }

    if (session.status !== 'paying') {
      return res.status(400).json({ message: 'Checkout has not been initiated yet. Host must select a split method first.' });
    }

    // Mark this user as paid in a session-level paymentBreakdown map
    if (!session.paymentBreakdown) {
      session.paymentBreakdown = {};
    }

    session.paymentBreakdown[userIdStr] = {
      paid: true,
      paidAt: new Date().toISOString()
    };
    session.markModified('paymentBreakdown'); // Required for Mixed type fields
    await session.save();

    const sessionIdStr = session._id.toString();

    // Rule 4: Emit before response so other guests' screens update in real-time
    io.to(`table_room_${sessionIdStr}`).emit('payment_updated', {
      userId: userIdStr,
      paid: true,
      paymentBreakdown: session.paymentBreakdown
    });

    // Check if ALL participants have paid
    const allParticipantIds = session.participants.map(p => p.toString());
    const allPaid = allParticipantIds.every(pid => session.paymentBreakdown[pid]?.paid === true);

    if (allPaid) {
      // ---- SESSION CLOSURE FLOW ----

      // 1. Mark all orders for this session as fully Paid
      await Order.updateMany(
        { sessionId: session._id },
        { $set: { paymentStatus: 'Paid' } }
      );

      // 2. Mark the session as completed
      session.status = 'completed';
      await session.save();

      // 3. Free the physical table and try to seat next in queue
      const physicalTable = await Table.findOne({ tableNumber: session.tableNumber });
      if (physicalTable) {
        await trySeatingNextInQueue(physicalTable, io);
      }

      // 4. Notify all guests that the session is complete — everyone gets kicked to home
      io.to(`table_room_${sessionIdStr}`).emit('session_closed', {
        message: 'All shares settled! Thanks for dining with SmartDine. See you again!'
      });

      return res.status(200).json({
        message: 'All shares settled. Session closed.',
        sessionClosed: true
      });
    }

    res.status(200).json({
      message: 'Payment recorded.',
      sessionClosed: false,
      paymentBreakdown: session.paymentBreakdown
    });
  } catch (error) {
    console.error('Error processing payment:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBill,
  setSplitMethod,
  setTip,
  createPaymentIntent,
  payShare
};
