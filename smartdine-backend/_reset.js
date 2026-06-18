const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const s = await mongoose.connection.db.collection('tablesessions').updateMany(
    { status: { $ne: 'completed' } }, { $set: { status: 'completed' } }
  );
  const t = await mongoose.connection.db.collection('tables').updateMany(
    { status: 'occupied' }, { $set: { status: 'available' } }
  );
  const q = await mongoose.connection.db.collection('queueentries').updateMany(
    { status: 'waiting' }, { $set: { status: 'completed' } }
  );
  console.log('Sessions completed:', s.modifiedCount, '| Tables freed:', t.modifiedCount, '| Queues cleared:', q.modifiedCount);
  process.exit(0);
});
