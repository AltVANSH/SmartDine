const Order = require('../models/Order');
const TableSession = require('../models/TableSession');

// Helper to find the latest active table session for a user
const findActiveSession = async (userId) => {
  return await TableSession.findOne({
    status: { $ne: 'completed' },
    $or: [{ hostId: userId }, { participants: userId }]
  }).sort({ createdAt: -1 }); // Rule 7: Always sort by createdAt: -1 to get latest session
};

// @desc    Convert active session's Redis cart to MongoDB Order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const redisClient = req.app.get('redisClient');
    const io = req.app.get('io');
    const userId = req.user._id;

    // Find user's active table session
    const session = await findActiveSession(userId);
    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    const sessionIdStr = session._id.toString(); // Rule 2: Explicitly call .toString()
    const cartKey = `cart:${sessionIdStr}`;
    const cartData = await redisClient.hgetall(cartKey);

    if (!cartData || Object.keys(cartData).length === 0) {
      return res.status(400).json({ message: 'Cart is empty. Add dishes to start ordering.' });
    }

    // Parse items from Redis cart
    const cartItems = Object.values(cartData).map((val) => JSON.parse(val));
    
    let totalAmount = 0;
    const orderItems = cartItems.map((item) => {
      totalAmount += item.price * item.quantity;
      return {
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        addedBy: item.addedBy?.id || item.addedBy,
        status: 'Received'
      };
    });

    // Create the order document
    const order = await Order.create({
      sessionId: session._id,
      tableNumber: session.tableNumber,
      items: orderItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      status: 'Received',
      paymentStatus: 'Pending'
    });

    // Delete Redis cart cache
    await redisClient.del(cartKey);

    // Rule 4: Emit socket events to update other clients in the room before response
    const tableRoom = `table_room_${sessionIdStr}`;
    io.to(tableRoom).emit('cart_updated', []); // Clear cart for all guests at table
    io.to(tableRoom).emit('order_status_updated', {
      orderId: order._id.toString(),
      status: 'Received',
      order
    });

    // Notify KDS of the new order
    io.to('kitchen_room').emit('order_received', order);
    // Notify Waiters of the new order
    io.to('waiter_room').emit('waiter_order_updated', order);

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active orders for the current user's table session
// @route   GET /api/orders/session
// @access  Private
const getSessionOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const session = await findActiveSession(userId);

    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    const orders = await Order.find({
      sessionId: session._id,
      status: { $ne: 'Served' }
    }).sort({ createdAt: 1 }); // Oldest first to match preparation priority

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching session orders:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all active orders for the Kitchen Display System
// @route   GET /api/orders/kds
// @access  Private
const getKDSOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $ne: 'Served' }
    }).sort({ createdAt: 1 }); // Oldest first to prioritize first-come first-served

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching KDS orders:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order preparation status
// @route   PUT /api/orders/:id/status
// @access  Private
const updateOrderStatus = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Received', 'Preparing', 'Ready', 'Served'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.status = status;
    order.items.forEach(item => {
      item.status = status;
    });

    await order.save();

    const sessionIdStr = order.sessionId.toString(); // Rule 2: Explicit toString

    // Rule 4: Emit socket events to relevant rooms
    io.to(`table_room_${sessionIdStr}`).emit('order_status_updated', {
      orderId: order._id.toString(),
      status: order.status,
      order
    });

    io.to('kitchen_room').emit('kds_order_updated', order);
    io.to('waiter_room').emit('waiter_order_updated', order); // Notify waiter room

    res.status(200).json(order);
  } catch (error) {
    console.error('Error updating order status:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders with status Ready for Waiters
// @route   GET /api/orders/waiter
// @access  Private
const getWaiterOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $in: ['Received', 'Preparing', 'Ready'] }
    }).sort({ createdAt: 1 });

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching Waiter orders:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order item status
// @route   PUT /api/orders/:orderId/items/:itemId/status
// @access  Private
const updateOrderItemStatus = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { orderId, itemId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Received', 'Preparing', 'Ready', 'Served'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const item = order.items.id(itemId);
    if (!item) {
       return res.status(404).json({ message: 'Item not found in order.' });
    }

    item.status = status;

    // Reconcile overall order status
    const allServed = order.items.every(i => i.status === 'Served');
    const allReadyOrServed = order.items.every(i => i.status === 'Ready' || i.status === 'Served');
    const anyPreparingOrReady = order.items.some(i => i.status === 'Preparing' || i.status === 'Ready');

    if (allServed) {
      order.status = 'Served';
    } else if (allReadyOrServed) {
      order.status = 'Ready';
    } else if (anyPreparingOrReady) {
      order.status = 'Preparing';
    } else {
      order.status = 'Received';
    }

    await order.save();

    const sessionIdStr = order.sessionId.toString();

    // Rule 4: Emit socket events
    io.to(`table_room_${sessionIdStr}`).emit('order_status_updated', {
      orderId: order._id.toString(),
      status: order.status,
      order
    });

    io.to('kitchen_room').emit('kds_order_updated', order);
    io.to('waiter_room').emit('waiter_order_updated', order); // Notify waiter room

    res.status(200).json(order);
  } catch (error) {
    console.error('Error updating order item status:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark order as served
// @route   PUT /api/orders/:id/serve
// @access  Private
const serveOrder = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.status = 'Served';
    order.items.forEach(item => {
      item.status = 'Served';
    });
    order.servedBy = req.user._id; // The authenticated waiter's ID

    await order.save();

    const sessionIdStr = order.sessionId.toString();

    // Rule 4: Emit socket events
    io.to(`table_room_${sessionIdStr}`).emit('order_status_updated', {
      orderId: order._id.toString(),
      status: order.status,
      order
    });

    io.to('kitchen_room').emit('kds_order_updated', order);
    io.to('waiter_room').emit('waiter_order_updated', order);

    res.status(200).json(order);
  } catch (error) {
    console.error('Error serving order:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createOrder,
  getSessionOrders,
  getKDSOrders,
  updateOrderStatus,
  getWaiterOrders,
  updateOrderItemStatus,
  serveOrder
};
