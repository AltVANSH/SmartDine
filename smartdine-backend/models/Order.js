const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', required: true },
  tableNumber: { type: Number, required: true },
  items: [{
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' },
    name: String,
    price: Number,
    quantity: { type: Number, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'DinerUser' }, // For itemized billing
    status: { type: String, enum: ['Received', 'Preparing', 'Ready', 'Served'], default: 'Received' }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['Received', 'Preparing', 'Ready', 'Served'], default: 'Received' },
  paymentStatus: { type: String, enum: ['Pending', 'Partial', 'Paid'], default: 'Pending' },
  servedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffUser' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);