const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const dinerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  currentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', default: null } 
}, { timestamps: true });

// Hash password before saving
dinerSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
dinerSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('DinerUser', dinerSchema);