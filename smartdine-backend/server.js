const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Redis = require('ioredis');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const TableSession = require('./models/TableSession');

// Load env variables from .env file
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// ==========================================
// REDIS CONNECTION (In-Memory Cache & Locks)
// ==========================================
const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on('connect', () => {
  console.log('Redis Cloud Connected Successfully');
});

redisClient.on('error', (error) => {
  console.error(`Error connecting to Redis: ${error.message}`);
});

// Attach io and redisClient to app to resolve circular dependencies in controllers
app.set('io', io);
app.set('redisClient', redisClient);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json()); // Allows parsing JSON bodies

// ==========================================
// ROUTES
// ==========================================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/queue', require('./routes/queueRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'SmartDine API is running.' });
});

// ==========================================
// MONGODB CONNECTION (Primary Database)
// ==========================================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Stop the server if MongoDB fails
  }
};

// ==========================================
// SOCKET.IO MIDDLEWARE & HANDLERS
// ==========================================
io.use((socket, next) => {
  try {
    const tokenHeader = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    if (!tokenHeader) {
      return next(new Error('Authentication failed. No token provided.'));
    }

    let token = tokenHeader;
    if (tokenHeader.startsWith('Bearer ')) {
      token = tokenHeader.split(' ')[1];
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    return next(new Error('Authentication failed. Invalid token.'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket Connected: User ${socket.userId} (Socket ID: ${socket.id})`);

  socket.on('join_table', async ({ sessionId }) => {
    try {
      if (!sessionId) {
        socket.emit('error_message', 'Session ID is required.');
        return;
      }

      const session = await TableSession.findById(sessionId);
      if (!session) {
        socket.emit('error_message', 'Table session not found.');
        return;
      }

      const isParticipant = session.participants.some(
        (id) => id.toString() === socket.userId
      ) || session.hostId.toString() === socket.userId;

      if (!isParticipant) {
        socket.emit('error_message', 'Not authorized to join this table room.');
        return;
      }

      const roomName = `table_room_${sessionId}`;
      socket.join(roomName);
      console.log(`User ${socket.userId} joined room: ${roomName}`);
      
      socket.to(roomName).emit('user_joined', { userId: socket.userId });
    } catch (error) {
      console.error('Error joining table room:', error.message);
      socket.emit('error_message', 'Internal error joining table room.');
    }
  });

  socket.on('join_kitchen', () => {
    socket.join('kitchen_room');
    console.log(`Socket User ${socket.userId} joined kitchen_room`);
  });

  socket.on('join_waiter', () => {
    socket.join('waiter_room');
    console.log(`Socket User ${socket.userId} joined waiter_room`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket Disconnected: User ${socket.userId} (Socket ID: ${socket.id})`);
  });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});

// Export app, server, io and redisClient for use in other files later
module.exports = { app, server, io, redisClient };