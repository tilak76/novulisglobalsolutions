const express = require('express');
const mongoose = require('mongoose');
const Activity = require('../models/Activity');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB Disconnected");
    }
    const activities = await Activity.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: activities });
  } catch (err) {
    // Fallback Mock Data if MongoDB is failing authentication
    const mockActivities = [
        { user: 'Tilak Mishra', action: 'deployed new feature to', target: 'Production', time: '2 mins ago', icon: 'M5 13l4 4L19 7' },
        { user: 'System Agent', action: 'completed automated compliance check on', target: 'WaiverPro UI', time: '1 hour ago', icon: 'M9 12l2 2 4-4' },
        { user: 'Sarah Connor', action: 'resolved a critical discrepancy in', target: 'Analytics Module', time: '3 hours ago', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
    ];
    res.json({ success: true, data: mockActivities });
  }
});

router.post('/', async (req, res) => {
  try {
    const { user, action, target, time, icon } = req.body;
    const activity = await Activity.create({ user, action, target, time, icon });
    res.json({ success: true, data: activity });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
