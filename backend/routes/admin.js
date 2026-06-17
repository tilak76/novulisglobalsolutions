const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(['SuperAdmin']));

router.get('/', async (req, res) => {
    try {
        const admins = await User.find({ role: 'Admin' }).select('-password');
        res.json({ success: true, data: admins });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await User.create({
            name, email, phone, password: hashedPassword, role: 'Admin', createdBy: req.user.userId
        });
        admin.password = undefined;
        res.json({ success: true, data: admin });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        let updates = { name, email, phone };
        if (password) updates.password = await bcrypt.hash(password, 10);

        const admin = await User.findOneAndUpdate({ _id: req.params.id, role: 'Admin' }, updates, { new: true }).select('-password');
        res.json({ success: true, data: admin });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await User.findOneAndDelete({ _id: req.params.id, role: 'Admin' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
