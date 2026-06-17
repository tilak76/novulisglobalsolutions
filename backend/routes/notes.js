const express = require('express');
const Note = require('../models/Note');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, roleMiddleware(['User']));

router.get('/', async (req, res) => {
    try {
        const notes = await Note.find({ user: req.user.userId });
        res.json({ success: true, data: notes });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;
        const note = await Note.create({ title, content, user: req.user.userId });
        res.json({ success: true, data: note });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { title, content } = req.body;
        const note = await Note.findOneAndUpdate(
            { _id: req.params.id, user: req.user.userId },
            { title, content },
            { new: true }
        );
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json({ success: true, data: note });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
