const Menu = require('../models/Menu');
const TableSession = require('../models/TableSession');

// Helper to find active table session for a user
const findActiveSession = async (userId) => {
  return await TableSession.findOne({
    status: { $ne: 'completed' },
    $or: [{ hostId: userId }, { participants: userId }]
  }).sort({ createdAt: -1 }); // Always pick the LATEST active session
};

// @desc    Get current shared cart for active session
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const redisClient = req.app.get('redisClient');
    const userId = req.user._id;
    const session = await findActiveSession(userId);

    if (!session) {
      return res.status(404).json({ message: 'No active table session found.' });
    }

    const cartKey = `cart:${session._id}`;
    const cartData = await redisClient.hgetall(cartKey);

    // Format cartData (which is an object of field: value strings)
    const cartItems = Object.values(cartData).map((val) => JSON.parse(val));
    res.status(200).json(cartItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add item to shared cart (with atomic Redis locking)
// @route   POST /api/cart/add
// @access  Private
const addToCart = async (req, res) => {
  const redisClient = req.app.get('redisClient');
  const io = req.app.get('io');
  const { menuItemId } = req.body;
  const userId = req.user._id;

  if (!menuItemId) {
    return res.status(400).json({ message: 'Please provide a menu item ID.' });
  }

  const session = await findActiveSession(userId);
  if (!session) {
    return res.status(404).json({ message: 'No active table session found.' });
  }

  const lockKey = `lock:item:${menuItemId}`;
  const lockVal = userId.toString();
  const cartKey = `cart:${session._id}`;
  const fieldKey = `${menuItemId}:${userId}`;

  let lockAcquired = false;

  try {
    // 1. Acquire atomic Redis lock (fails if key exists, expires in 3 seconds)
    const acquired = await redisClient.set(lockKey, lockVal, 'NX', 'EX', 3);
    
    if (acquired !== 'OK') {
      return res.status(409).json({ 
        message: 'This item is currently being ordered by another guest. Please try again.' 
      });
    }
    lockAcquired = true;

    // 2. Query MongoDB for item availability
    const menuItem = await Menu.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    // 3. Check stock levels
    if (menuItem.stockQuantity < 1) {
      return res.status(400).json({ message: 'Sorry, this item is sold out!' });
    }

    // 4. Deduct stock from MongoDB
    menuItem.stockQuantity -= 1;
    await menuItem.save();

    // 5. Update Redis Shared Cart Cache
    const existingCartVal = await redisClient.hget(cartKey, fieldKey);
    let updatedCartItem;

    if (existingCartVal) {
      const parsed = JSON.parse(existingCartVal);
      parsed.quantity += 1;
      updatedCartItem = parsed;
    } else {
      updatedCartItem = {
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        addedBy: {
          id: userId,
          name: req.user.name
        }
      };
    }

    await redisClient.hset(cartKey, fieldKey, JSON.stringify(updatedCartItem));

    // 6. Fetch full cart and broadcast update via WebSockets
    const cartData = await redisClient.hgetall(cartKey);
    const cartItems = Object.values(cartData).map((val) => JSON.parse(val));

    // Emit live update to all tables in the session room
    io.to(`table_room_${session._id.toString()}`).emit('cart_updated', cartItems);
    
    // Global broadcast to update menu stock for everyone
    io.emit('menu_updated');

    res.status(200).json(cartItems);

  } catch (error) {
    console.error('Error adding to cart:', error.message);
    res.status(500).json({ message: error.message });
  } finally {
    // 7. Release lock safely (only if lock value matches current user's lockVal)
    if (lockAcquired) {
      const currentLock = await redisClient.get(lockKey);
      if (currentLock === lockVal) {
        await redisClient.del(lockKey);
      }
    }
  }
};

// @desc    Remove item from shared cart (with atomic Redis locking)
// @route   POST /api/cart/remove
// @access  Private
const removeFromCart = async (req, res) => {
  const redisClient = req.app.get('redisClient');
  const io = req.app.get('io');
  const { menuItemId } = req.body;
  const userId = req.user._id;

  if (!menuItemId) {
    return res.status(400).json({ message: 'Please provide a menu item ID.' });
  }

  const session = await findActiveSession(userId);
  if (!session) {
    return res.status(404).json({ message: 'No active table session found.' });
  }

  const lockKey = `lock:item:${menuItemId}`;
  const lockVal = userId.toString();
  const cartKey = `cart:${session._id}`;
  const fieldKey = `${menuItemId}:${userId}`;

  let lockAcquired = false;

  try {
    // 1. Acquire atomic Redis lock
    const acquired = await redisClient.set(lockKey, lockVal, 'NX', 'EX', 3);
    
    if (acquired !== 'OK') {
      return res.status(409).json({ 
        message: 'This item is currently being modified. Please try again.' 
      });
    }
    lockAcquired = true;

    // 2. Fetch item from cart
    const existingCartVal = await redisClient.hget(cartKey, fieldKey);
    if (!existingCartVal) {
      return res.status(400).json({ message: 'Item not found in your cart.' });
    }

    const parsed = JSON.parse(existingCartVal);
    parsed.quantity -= 1;

    // 3. Update Redis cache
    if (parsed.quantity <= 0) {
      await redisClient.hdel(cartKey, fieldKey);
    } else {
      await redisClient.hset(cartKey, fieldKey, JSON.stringify(parsed));
    }

    // 4. Return stock to MongoDB
    const menuItem = await Menu.findById(menuItemId);
    if (menuItem) {
      menuItem.stockQuantity += 1;
      await menuItem.save();
    }

    // 5. Fetch full cart and broadcast update
    const cartData = await redisClient.hgetall(cartKey);
    const cartItems = Object.values(cartData).map((val) => JSON.parse(val));

    io.to(`table_room_${session._id.toString()}`).emit('cart_updated', cartItems);

    res.status(200).json(cartItems);

  } catch (error) {
    console.error('Error removing from cart:', error.message);
    res.status(500).json({ message: error.message });
  } finally {
    // 6. Release lock
    if (lockAcquired) {
      const currentLock = await redisClient.get(lockKey);
      if (currentLock === lockVal) {
        await redisClient.del(lockKey);
      }
    }
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart
};
