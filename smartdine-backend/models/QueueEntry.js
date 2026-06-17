const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'DinerUser', required: true },
  partySize: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['waiting', 'notified', 'seated', 'cancelled'], default: 'waiting' },
  allocatedTableNumber: { type: Number, default: null },
  estimatedWaitTimeMins: { type: Number, default: 0 },
  targetTableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('QueueEntry', queueEntrySchema);