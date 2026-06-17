const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String, enum: ['Appetizers', 'Mains', 'Desserts', 'Drinks'], required: true },
  tags: [{ type: String }], // e.g. ["spicy", "vegan", "bestseller"] -> Used for Atlas Search
  stockQuantity: { type: Number, default: 100 }, // For Redis atomic locks
  isAvailable: { type: Boolean, default: true },
  estimatedPrepTimeMins: { type: Number, default: 15 } 
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);