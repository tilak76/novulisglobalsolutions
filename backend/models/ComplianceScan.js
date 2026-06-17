const mongoose = require('mongoose');

const ComplianceScanSchema = new mongoose.Schema({
  score: { type: Number, required: true },
  trend: { type: Number, default: 0 },
  pagesScanned: { type: Number, default: 0 },
  issuesFound: { type: Number, default: 0 },
  status: { type: String, enum: ['Completed', 'Failed', 'In Progress'], default: 'Completed' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ComplianceScan', ComplianceScanSchema);
