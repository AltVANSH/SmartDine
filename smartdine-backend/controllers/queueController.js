const QueueEntry = require('../models/QueueEntry');
const Table = require('../models/Table');
const TableSession = require('../models/TableSession');
const crypto = require('crypto');

// @desc    Join the queue or get seated immediately
// @route   POST /api/queue/join
// @access  Private (User must be logged in)
const joinQueue = async (req, res) => {
  try {
    const { partySize } = req.body;
    const hostId = req.user._id; // Comes from our auth middleware

    if (!partySize || partySize < 1) {
      return res.status(400).json({ message: 'Please provide a valid party size' });
    }

    // 1. Find all tables that can fit this party
    const suitableTables = await Table.find({ capacity: { $gte: partySize } });

    if (suitableTables.length === 0) {
      return res.status(400).json({ message: 'Sorry, we do not have tables large enough for your party.' });
    }

    // 2. Check if any suitable table is currently 'available'
    const availableTable = suitableTables.find(table => table.status === 'available');

    if (availableTable) {
      // SEAT IMMEDIATELY: Create a TableSession
      const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g., "A1B2C3"
      
      // Calculate estimated end time (let's say average dining time is 60 mins)
      const estimatedEndTime = new Date();
      estimatedEndTime.setMinutes(estimatedEndTime.getMinutes() + 60);

      const newSession = await TableSession.create({
        tableNumber: availableTable.tableNumber,
        hotelName: availableTable.hotelName,
        hostId: hostId,
        participants: [hostId], // Host is the first participant
        joinCode: joinCode,
        estimatedEndTime: estimatedEndTime
      });

      // Update table status to occupied
      availableTable.status = 'occupied';
      await availableTable.save();

      // Emit to waiters that a table became occupied
      const io = req.app.get('io');
      io.to('waiter_room').emit('table_status_changed');

      // Update user's current session
      req.user.currentSessionId = newSession._id;
      await req.user.save();

      return res.status(201).json({
        message: 'Table allocated immediately!',
        session: newSession
      });
    }

    // 3. NO TABLES AVAILABLE: Put them in the queue
    const currentQueueSize = await QueueEntry.countDocuments({ status: 'waiting' });
    const estimatedWaitTimeMins = (currentQueueSize + 1) * 15;

    const newQueueEntry = await QueueEntry.create({
      hostId: hostId,
      partySize: partySize,
      estimatedWaitTimeMins: estimatedWaitTimeMins
    });

    res.status(201).json({
      message: 'Added to waitlist',
      queue: newQueueEntry
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join an active table using a 6-character code
// @route   POST /api/queue/join-table
// @access  Private (User must be logged in)
const joinTableWithCode = async (req, res) => {
  try {
    const { joinCode } = req.body;
    const userId = req.user._id;
    const io = req.app.get('io');

    // 1. Find the active table session with this exact code
    const session = await TableSession.findOne({ 
      joinCode: joinCode.toUpperCase()
    }); 

    if (!session) {
      return res.status(404).json({ message: 'Invalid or expired invite code.' });
    }

    // 2. Add the user to the session's participants array
    if (!session.participants) session.participants = [];
    
    // Use .toString() for safe ObjectId comparison (avoids reference equality bugs)
    const alreadyJoined = session.participants.some(
      (pId) => pId.toString() === userId.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({ message: 'You are already sitting at this table!' });
    }

    session.participants.push(userId);
    await session.save();

    // 3. Notify the table room via WebSocket so the host & other guests refresh their participant list
    const roomName = `table_room_${session._id.toString()}`;
    io.to(roomName).emit('user_joined', { userId: userId.toString() });

    // 4. Return success
    res.status(200).json({
      message: 'Successfully joined the table!',
      session: {
        tableNumber: session.tableNumber,
        joinCode: session.joinCode
      }
    });

  } catch (error) {
    console.error('Error joining table with code:', error);
    res.status(500).json({ message: 'Server error while joining table.' });
  }
};

// @desc    Validate restaurant/branch code
// @route   POST /api/queue/validate-code
// @access  Public
const validateRestaurantCode = async (req, res) => {
  try {
    const { restaurantCode } = req.body;

    if (!restaurantCode || restaurantCode.trim().length < 3) {
      return res.status(400).json({ message: 'Please provide a valid restaurant code (min 3 chars).' });
    }

    // In a fully-fledged multi-tenant system, this would query a Hotel/Restaurant model:
    // const restaurant = await Restaurant.findOne({ code: restaurantCode.toUpperCase() });
    // if (!restaurant) return res.status(404)...
    
    // For now, we simulate that any valid formatted code corresponds to a restaurant
    return res.status(200).json({ 
      status: 'success', 
      message: 'Code validated successfully.',
      code: restaurantCode.toUpperCase()
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's current dining/waitlist session
// @route   GET /api/queue/current-session
// @access  Private
const getCurrentSession = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Find active table session where user is host or participant
    const activeSession = await TableSession.findOne({
      status: { $ne: 'completed' },
      $or: [
        { hostId: userId },
        { participants: userId }
      ]
    }).sort({ createdAt: -1 }).populate('hostId', 'name email').populate('participants', 'name email');

    if (activeSession) {
      return res.status(200).json({ status: 'seated', session: activeSession });
    }

    // 2. Find active queue entry
    const activeQueue = await QueueEntry.findOne({
      hostId: userId,
      status: 'waiting'
    });

    if (activeQueue) {
      return res.status(200).json({ status: 'waiting', queue: activeQueue });
    }

    return res.status(200).json({ status: 'idle' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export ALL functions properly at the bottom
module.exports = { 
  joinQueue, 
  joinTableWithCode,
  validateRestaurantCode,
  getCurrentSession
};