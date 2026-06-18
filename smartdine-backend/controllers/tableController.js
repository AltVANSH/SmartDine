const Table = require('../models/Table');
const TableSession = require('../models/TableSession');
const QueueEntry = require('../models/QueueEntry');
const crypto = require('crypto');

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

  // Notify waiters
  io.to('waiter_room').emit('table_status_changed');

  // Notify the newly seated user via socket
  io.emit('queue_seated', {
    userId: nextInQueue.hostId.toString(),
    session: newSession
  });

  console.log(`Queue guest ${nextInQueue.hostId} seated at Table ${table.tableNumber}.`);
};

// @desc    Get all tables with their current session status
// @route   GET /api/tables
// @access  Private (Waiters/Staff)
const getTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    const tablesWithSession = await Promise.all(tables.map(async (table) => {
      // Find the most recent session for this table
      const latestSession = await TableSession.findOne({ tableNumber: table.tableNumber })
        .sort({ createdAt: -1 });
      
      let sessionStatus = null;
      let sessionId = null;
      let paymentBreakdown = {};
      
      if (latestSession) {
        sessionStatus = latestSession.status;
        sessionId = latestSession._id;
        paymentBreakdown = latestSession.paymentBreakdown || {};
      }

      return {
        _id: table._id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        hotelName: table.hotelName,
        status: table.status,
        sessionStatus,
        sessionId,
        paymentBreakdown
      };
    }));

    res.status(200).json(tablesWithSession);
  } catch (error) {
    console.error('Error fetching tables:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a table's status (Waiters)
// @route   PUT /api/tables/:id/status
// @access  Private (Waiters/Staff)
const updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const io = req.app.get('io');

    if (!['available', 'occupied', 'cleaning'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    if (status === 'cleaning') {
      // Waiter marks table for cleaning. Must be currently occupied.
      const table = await Table.findOneAndUpdate(
        { _id: id, status: 'occupied' },
        { status: 'cleaning' },
        { new: true }
      );

      if (!table) {
        return res.status(400).json({ message: 'Table is not occupied or already modified.' });
      }

      io.to('waiter_room').emit('table_status_changed');
      return res.status(200).json(table);
    }

    if (status === 'available') {
      // Waiter marks table as vacant (available). Must be currently cleaning.
      const table = await Table.findOneAndUpdate(
        { _id: id, status: 'cleaning' },
        { status: 'available' },
        { new: true } // We'll modify it further in trySeatingNextInQueue if someone is waiting
      );

      if (!table) {
        return res.status(400).json({ message: 'Table is not being cleaned or already modified.' });
      }

      // Automatically seat the next person in queue if any, otherwise it stays available.
      await trySeatingNextInQueue(table, io);
      
      io.to('waiter_room').emit('table_status_changed');
      return res.status(200).json(table);
    }

    res.status(400).json({ message: 'Invalid state transition.' });

  } catch (error) {
    console.error('Error updating table status:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTables,
  updateTableStatus
};
