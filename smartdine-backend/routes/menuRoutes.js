const express = require('express');
const router = express.Router();
const { getMenu, searchMenu, addMenuItem } = require('../controllers/menuController');

// Search route MUST come before the /:id routes if we add them later
router.get('/search', searchMenu);
router.get('/', getMenu);
router.post('/', addMenuItem);

module.exports = router;