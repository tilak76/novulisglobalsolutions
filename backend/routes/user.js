const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(['SuperAdmin', 'Admin']));

router.get('/', async (req, res) => {
    try {
        let query = { role: 'User' };
        if (req.user.role === 'Admin') query.createdBy = req.user.userId;

        const users = await User.find(query).select('-password');
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name, email, phone, password: hashedPassword, role: 'User', createdBy: req.user.userId
        });
        user.password = undefined;
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        let query = { _id: req.params.id, role: 'User' };
        if (req.user.role === 'Admin') query.createdBy = req.user.userId;

        const { name, email, phone, password } = req.body;
        let updates = { name, email, phone };
        if (password) updates.password = await bcrypt.hash(password, 10);

        const user = await User.findOneAndUpdate(query, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ error: 'Not found or forbidden' });

        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        let query = { _id: req.params.id, role: 'User' };
        if (req.user.role === 'Admin') query.createdBy = req.user.userId;

        const user = await User.findOneAndDelete(query);
        if (!user) return res.status(404).json({ error: 'Not found or forbidden' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
