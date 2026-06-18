const express = require('express');
const router = express.Router();
const { getMenu, searchMenu, addMenuItem, updateInventory } = require('../controllers/menuController');

// Search route MUST come before the /:id routes if we add them later
router.get('/search', searchMenu);
router.get('/', getMenu);
router.post('/', addMenuItem);
router.put('/:id/inventory', updateInventory);

module.exports = router;