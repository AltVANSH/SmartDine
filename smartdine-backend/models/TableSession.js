const mongoose = require('mongoose');

const tableSessionSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true },
  hotelName: { type: String, required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'DinerUser', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DinerUser' }],
  joinCode: { type: String, unique: true, sparse: true }, // The shareable link token
  assignedWaiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffUser' },
  status: { type: String, enum: ['active', 'ordering', 'paying', 'completed'], default: 'active' },
  estimatedEndTime: { type: Date, required: true }, // For Queue EWT calculations
  paymentSplitMethod: { type: String, enum: ['unselected', 'single_payer', 'split_evenly', 'itemized'], default: 'unselected' },
  paymentBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} }, // { [userId]: { paid: Boolean, paidAt: ISO string } }
  tipPercentage: { type: Number, default: 0 } // e.g., 0, 15, 18, 20
}, { timestamps: true });

module.exports = mongoose.model('TableSession', tableSessionSchema);