const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // If the error is an authentication error due to <db_password>, don't exit the whole process 
    // so the rest of the app doesn't crash immediately, but log prominently.
    if (error.message.includes('<db_password>')) {
      console.log("\n\n**************************************************************");
      console.log("   ATTENTION: You must replace '<db_password>' in your .env");
      console.log("   file with your actual MongoDB password to connect!");
      console.log("**************************************************************\n\n");
    }
  }
};

module.exports = connectDB;
