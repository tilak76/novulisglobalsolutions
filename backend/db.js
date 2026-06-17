const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/role-dashboard');
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error. Backend will run without DB.', err.message);
    }
};

module.exports = connectDB;
