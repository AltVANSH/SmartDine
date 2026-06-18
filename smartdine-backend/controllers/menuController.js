const Menu = require('../models/Menu');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
const getMenu = async (req, res) => {
  try {
    const menuItems = await Menu.find({});
    res.status(200).json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search menu items (Intelligent Search)
// @route   GET /api/menu/search?q=burger
// @access  Public
const searchMenu = async (req, res) => {
  try {
    const searchQuery = req.query.q;

    if (!searchQuery) {
      return res.status(400).json({ message: 'Please provide a search term' });
    }

    // Using MongoDB $regex for flexible matching (case-insensitive)
    // It searches the name, description, OR the tags array!
    const results = await Menu.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { tags: { $regex: searchQuery, $options: 'i' } }
      ]
    });

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new menu item (Admin/Manager only later, public for now to test)
// @route   POST /api/menu
// @access  Public (for development)
const addMenuItem = async (req, res) => {
  try {
    const { name, description, price, category, tags, stockQuantity, estimatedPrepTimeMins } = req.body;

    const menuItem = await Menu.create({
      name,
      description,
      price,
      category,
      tags,
      stockQuantity,
      estimatedPrepTimeMins
    });

    res.status(201).json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update menu item inventory (Kitchen/Manager only)
// @route   PUT /api/menu/:id/inventory
// @access  Private (Assume token validation in real app, keeping simple for demo)
const updateInventory = async (req, res) => {
  try {
    const { stockQuantity, isAvailable } = req.body;
    const menuItemId = req.params.id;

    const menuItem = await Menu.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    if (stockQuantity !== undefined) {
      menuItem.stockQuantity = Math.max(0, parseInt(stockQuantity));
      if (menuItem.stockQuantity === 0) {
        menuItem.isAvailable = false;
      }
    }
    
    if (isAvailable !== undefined) {
      menuItem.isAvailable = isAvailable;
    }

    await menuItem.save();

    // Broadcast menu update to all clients to refresh their MenuSearch components
    const io = req.app.get('io');
    if (io) {
      io.emit('menu_updated');
    }

    res.status(200).json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMenu, searchMenu, addMenuItem, updateInventory };