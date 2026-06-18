const jwt = require('jsonwebtoken');
const DinerUser = require('../models/DinerUser');
const StaffUser = require('../models/StaffUser');

// This middleware will be used later to protect routes (like adding to cart)
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (Format: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token payload (excluding the password)
      let user = await DinerUser.findById(decoded.id).select('-password');
      
      if (!user) {
        user = await StaffUser.findById(decoded.id).select('-password');
      }

      if (!user) {
         return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      req.user = user;
      next(); // Move on to the next function
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };