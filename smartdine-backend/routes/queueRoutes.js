const express = require('express');
const router = express.Router();

const { joinQueue, joinTableWithCode, validateRestaurantCode, getCurrentSession } = require('../controllers/queueController');
const { protect } = require('../middleware/authMiddleware');

router.post('/validate-code', validateRestaurantCode);
router.get('/current-session', protect, getCurrentSession);
router.post('/join', protect, joinQueue);
router.post('/join-table', protect, joinTableWithCode);

module.exports = router;