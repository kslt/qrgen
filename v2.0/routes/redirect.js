const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const conn = await pool.getConnection();
    const [links] = await conn.query('SELECT destination FROM links WHERE slug = ?', [slug]);
    conn.release();

    if (links.length === 0) return res.status(404).send('Länk hittades inte');
    res.redirect(links[0].destination);
  } catch (error) {
    console.error(error);
    res.status(500).send('Serverfel vid omdirigering');
  }
});

module.exports = router;
