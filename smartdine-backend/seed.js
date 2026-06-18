const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Menu = require('./models/Menu');
const Table = require('./models/Table');

// Load environment variables
dotenv.config();

const menuItems = [
  {
    name: 'Crispy Spring Rolls',
    description: 'Golden-fried vegetable spring rolls served with sweet chili sauce.',
    price: 6.99,
    category: 'Appetizers',
    tags: ['vegetarian', 'crispy'],
    stockQuantity: 50,
    isAvailable: true,
    estimatedPrepTimeMins: 10
  },
  {
    name: 'Spicy Garlic Wings',
    description: 'Crispy chicken wings tossed in a spicy garlic glaze.',
    price: 9.99,
    category: 'Appetizers',
    tags: ['spicy', 'bestseller'],
    stockQuantity: 40,
    isAvailable: true,
    estimatedPrepTimeMins: 12
  },
  {
    name: 'Classic Cheese Burger',
    description: 'Juicy beef patty with cheddar cheese, lettuce, tomato, and house sauce.',
    price: 12.99,
    category: 'Mains',
    tags: ['beef', 'popular'],
    stockQuantity: 30,
    isAvailable: true,
    estimatedPrepTimeMins: 15
  },
  {
    name: 'Paneer Butter Masala',
    description: 'Cottage cheese cubes simmered in a rich tomato and butter gravy.',
    price: 14.99,
    category: 'Mains',
    tags: ['vegetarian', 'spicy', 'creamy'],
    stockQuantity: 25,
    isAvailable: true,
    estimatedPrepTimeMins: 18
  },
  {
    name: 'Grilled Salmon',
    description: 'Fresh salmon fillet grilled to perfection, served with asparagus.',
    price: 19.99,
    category: 'Mains',
    tags: ['seafood', 'healthy'],
    stockQuantity: 15,
    isAvailable: true,
    estimatedPrepTimeMins: 20
  },
  {
    name: 'Sizzling Brownie',
    description: 'Hot chocolate brownie served on a sizzler plate with vanilla ice cream.',
    price: 7.99,
    category: 'Desserts',
    tags: ['chocolate', 'sweet', 'low-stock'],
    stockQuantity: 3, // Low stock for concurrency testing
    isAvailable: true,
    estimatedPrepTimeMins: 8
  },
  {
    name: 'New York Cheesecake',
    description: 'Classic rich and creamy cheesecake with a graham cracker crust.',
    price: 8.99,
    category: 'Desserts',
    tags: ['creamy', 'classic', 'last-slice'],
    stockQuantity: 1, // Extremely low stock
    isAvailable: true,
    estimatedPrepTimeMins: 5
  },
  {
    name: 'Fresh Lime Soda',
    description: 'Refreshing carbonated lime drink served chilled.',
    price: 3.99,
    category: 'Drinks',
    tags: ['refreshing', 'citrus'],
    stockQuantity: 100,
    isAvailable: true,
    estimatedPrepTimeMins: 4
  }
];

const tables = [
  { tableNumber: 10, hotelName: 'The Grand Taj', capacity: 2, status: 'available' },
  { tableNumber: 11, hotelName: 'The Grand Taj', capacity: 4, status: 'available' },
  { tableNumber: 12, hotelName: 'The Grand Taj', capacity: 4, status: 'available' },
  { tableNumber: 13, hotelName: 'The Grand Taj', capacity: 6, status: 'available' },
  { tableNumber: 14, hotelName: 'The Grand Taj', capacity: 8, status: 'available' }
];

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Wipe existing data
    console.log('Wiping existing menus and tables...');
    await Menu.deleteMany({});
    await Table.deleteMany({});
    console.log('Data wiped.');

    // Seed Menus
    console.log('Seeding menus...');
    const createdMenus = await Menu.insertMany(menuItems);
    console.log(`Successfully seeded ${createdMenus.length} menu items.`);

    // Seed Tables
    console.log('Seeding tables...');
    const createdTables = await Table.insertMany(tables);
    console.log(`Successfully seeded ${createdTables.length} tables.`);

    console.log('Database Seeding Complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
