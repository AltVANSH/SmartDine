const express = require('express');
const router = express.Router();
const { registerUser, loginUser, registerStaff, loginStaff } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/staff/register', registerStaff);
router.post('/staff/login', loginStaff);

module.exports = router;