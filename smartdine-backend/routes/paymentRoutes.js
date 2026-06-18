const express = require('express');
const router = express.Router();
const { getBill, setSplitMethod, payShare } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// GET  /api/payment/bill      -> Fetch the full consolidated bill for the current session
router.get('/bill', protect, getBill);

// POST /api/payment/method    -> Host sets the split method (itemized | split_evenly | single_payer)
router.post('/method', protect, setSplitMethod);

// POST /api/payment/pay       -> A diner pays their share (mock payment)
router.post('/pay', protect, payShare);

module.exports = router;
