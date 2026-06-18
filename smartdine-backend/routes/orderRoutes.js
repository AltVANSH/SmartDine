const express = require('express');
const router = express.Router();
const {
  createOrder,
  getSessionOrders,
  getKDSOrders,
  updateOrderStatus,
  getWaiterOrders,
  updateOrderItemStatus,
  serveOrder
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/session', protect, getSessionOrders);
router.get('/kds', protect, getKDSOrders);
router.get('/waiter', protect, getWaiterOrders);
router.put('/:id/status', protect, updateOrderStatus);
router.put('/:orderId/items/:itemId/status', protect, updateOrderItemStatus);
router.put('/:id/serve', protect, serveOrder);

module.exports = router;
