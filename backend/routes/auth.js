const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await User.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: 'User', // default role
        });

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1d' }
        );

        res.status(201).json({ success: true, token, role: user.role });
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Auto-seed Super Admin
        if (email === 'super@admin.com' && password === 'superadmin123') {
            let superAdmin = await User.findOne({ email });
            if (!superAdmin) {
                const hashedPassword = await bcrypt.hash(password, 10);
                superAdmin = await User.create({
                    name: 'Super Admin',
                    email,
                    phone: '0000000000',
                    password: hashedPassword,
                    role: 'SuperAdmin',
                });
            }
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1d' }
        );

        res.json({ success: true, token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
