const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const TableSession = require('./models/TableSession');
const Table = require('./models/Table');
const Order = require('./models/Order');

async function cleanDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Reset all tables to 'available'
    await Table.updateMany({}, { status: 'available' });
    console.log('All tables set to available');

    // 2. Complete all active sessions
    await TableSession.updateMany({ status: { $ne: 'completed' } }, { status: 'completed' });
    console.log('All active sessions marked as completed');

    // 3. (Optional) Complete all active orders
    await Order.updateMany({ status: { $ne: 'Served' } }, { status: 'Served', paymentStatus: 'Paid' });
    console.log('All active orders marked as Served/Paid');

    console.log('Cleanup finished!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

cleanDB();
