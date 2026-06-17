require('dotenv').config();
const mongoose = require('mongoose');

const pwdMatch = process.env.MONGO_URI.match(/:([^:@]+)@/);
console.log("Testing connection with parsed password:", pwdMatch ? pwdMatch[1] : 'not found');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("SUCCESS: Connected to MongoDB!");
    process.exit(0);
  })
  .catch(err => {
    console.error("ERROR: Failed to connect to MongoDB", err.message);
    process.exit(1);
  });
