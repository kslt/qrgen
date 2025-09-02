const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const register = async (req, res) => {
  const { email, password } = req.body;
  try {
    const conn = await pool.getConnection();

    const [existing] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'E-postadressen är redan registrerad.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await conn.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
    conn.release();

    res.status(201).json({ message: 'Användare registrerad!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Serverfel vid registrering' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const conn = await pool.getConnection();

    const [users] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    conn.release();

    if (users.length === 0) return res.status(401).json({ message: 'Fel e-post eller lösenord' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.status(401).json({ message: 'Fel e-post eller lösenord' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '12h'
    });

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Serverfel vid inloggning' });
  }
};

module.exports = { register, login };
