const express = require('express');
const expressApp = express();
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');

const path = require('path');

expressApp.use(cors());
expressApp.use(express.json());
expressApp.use('/screenshots', express.static(path.join(__dirname, '..', 'public', 'screenshots')));

connectDB();

expressApp.use('/api/auth', require('./routes/auth'));
expressApp.use('/api/admin', require('./routes/admin'));
expressApp.use('/api/user', require('./routes/user'));
expressApp.use('/api/notes', require('./routes/notes'));
expressApp.use('/api/verify', require('./routes/verify'));
expressApp.use('/api/activities', require('./routes/activities'));
expressApp.use('/api/team', require('./routes/team'));

const PORT = process.env.PORT || 5000;
expressApp.listen(PORT, () => console.log(`Server running on port ${PORT}`));
