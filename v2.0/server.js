const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const redirectRoutes = require('./routes/redirect');

app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/l', redirectRoutes); // För korta länkar: /l/abc123

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Servern kör på http://localhost:${PORT}`));
