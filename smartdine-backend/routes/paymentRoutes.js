const express = require('express');
const router = express.Router();
const { 
  getBill, 
  setSplitMethod, 
  setTip, 
  createPaymentIntent, 
  payShare,
  requestCashPayment,
  confirmCashPayment
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// GET  /api/payment/bill      -> Fetch the full consolidated bill for the current session
router.get('/bill', protect, getBill);

// POST /api/payment/method    -> Host sets the split method (itemized | split_evenly | single_payer)
router.post('/method', protect, setSplitMethod);

// POST /api/payment/tip       -> Host sets the tip percentage
router.post('/tip', protect, setTip);

// POST /api/payment/create-payment-intent -> User creates Stripe payment intent for their share
router.post('/create-payment-intent', protect, createPaymentIntent);

// POST /api/payment/pay       -> A diner pays their share (mock payment)
router.post('/pay', protect, payShare);

// POST /api/payment/request-cash -> A diner requests to pay cash
router.post('/request-cash', protect, requestCashPayment);

// PUT /api/payment/confirm-cash/:sessionId/:userId -> Waiter confirms cash receipt
router.put('/confirm-cash/:sessionId/:userId', protect, confirmCashPayment);

module.exports = router;
