const express = require('express');
const router = express.Router();
const { getStats, exportYesterday } = require('../controllers/managerController');
const { protect } = require('../middleware/authMiddleware');

router.get('/stats', protect, getStats);
router.get('/export/yesterday', protect, exportYesterday);

module.exports = router;
