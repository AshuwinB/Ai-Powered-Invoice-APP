const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Database connected successfully: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1); // exit process if DB fails
  }
};

module.exports = dbConnect;