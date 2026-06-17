const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Redis = require('ioredis');

// Load env variables from .env file
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Allows parsing JSON bodies

// ==========================================
// ROUTES
// ==========================================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'SmartDine API is running.' });
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
// START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});

// Export app and redisClient for use in other files later
module.exports = { app, redisClient };