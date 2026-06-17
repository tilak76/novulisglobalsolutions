const mongoose = require('mongoose');
const uri = "mongodb+srv://tilakmishra76_db_user:al-A6I4NA9uoI76u8sX1RIbYDcJ9aT5Csn-PrE6hZVArtY@tilak.rkcalw6.mongodb.net/?appName=tilak";

mongoose.connect(uri)
  .then(() => {
    console.log("SUCCESS: Connected to MongoDB!");
    process.exit(0);
  })
  .catch(err => {
    console.error("ERROR: Failed to connect to MongoDB", err.message);
    process.exit(1);
  });
