const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true, unique: true },
  hotelName: { type: String, required: true, default: "SmartDine Restaurant" },
  capacity: { type: Number, required: true },
  qrCodeUrl: { type: String, required: false },
  status: { type: String, enum: ['available', 'occupied', 'cleaning'], default: 'available' },
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);