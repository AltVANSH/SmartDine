const express = require('express');
const router = express.Router();
const { getTables, updateTableStatus } = require('../controllers/tableController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getTables);
router.put('/:id/status', protect, updateTableStatus);

module.exports = router;
