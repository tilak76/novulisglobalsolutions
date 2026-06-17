const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  user: { type: String, required: true },
  action: { type: String, required: true },
  target: { type: String, required: true },
  time: { type: String, required: true },
  icon: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', ActivitySchema);
