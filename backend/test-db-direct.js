const mongoose = require('mongoose');

// We will try two different connection strings just in case the username was a mixup
const uri1 = "mongodb+srv://dantil0902_db_user:TILAmish.76%40@examcracker.oklo3ij.mongodb.net/";
const uri2 = "mongodb+srv://tilakmishra76_db_user:TILAmish.76%40@tilak.rkcalw6.mongodb.net/";

async function testConnection(uri, label) {
  console.log(`\nTesting ${label}...`);
  try {
    await mongoose.connect(uri);
    console.log(`SUCCESS: Connected to ${label}!`);
    process.exit(0);
  } catch (err) {
    console.error(`ERROR on ${label}: ${err.message}`);
  }
}

async function runTests() {
  await testConnection(uri1, 'URI 1 (New Cluster + New User)');
  await testConnection(uri2, 'URI 2 (Old Cluster + Old User)');
  process.exit(1);
}

runTests();
