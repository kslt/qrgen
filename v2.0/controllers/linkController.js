const pool = require('../config/db');
const QRCode = require('qrcode');

function generateSlug(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const createLink = async (req, res) => {
  const { destination } = req.body;
  const userId = req.user.id;
  const slug = generateSlug();

  try {
    const conn = await pool.getConnection();
    await conn.query('INSERT INTO links (user_id, slug, destination) VALUES (?, ?, ?)', [userId, slug, destination]);
    conn.release();

    const qrUrl = `${req.protocol}://${req.get('host')}/l/${slug}`;
    const qrImage = await QRCode.toDataURL(qrUrl);

    res.status(201).json({
      message: 'Länk skapad',
      slug,
      qr_url: qrUrl,
      qr_image: qrImage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Kunde inte skapa länk' });
  }
};

const getMyLinks = async (req, res) => {
  const userId = req.user.id;
  try {
    const conn = await pool.getConnection();
    const links = await conn.query('SELECT slug, destination, created_at FROM links WHERE user_id = ?', [userId]);
    conn.release();
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: 'Fel vid hämtning av länkar' });
  }
};

const updateLink = async (req, res) => {
  const { slug } = req.params;
  const { destination } = req.body;
  const userId = req.user.id;
  try {
    const conn = await pool.getConnection();
    const result = await conn.query('UPDATE links SET destination = ? WHERE slug = ? AND user_id = ?', [destination, slug, userId]);
    conn.release();

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Länk ej hittad eller ingen behörighet' });

    res.json({ message: 'Länk uppdaterad' });
  } catch (error) {
    res.status(500).json({ message: 'Kunde inte uppdatera länk' });
  }
};

const deleteLink = async (req, res) => {
  const { slug } = req.params;
  const userId = req.user.id;
  try {
    const conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM links WHERE slug = ? AND user_id = ?', [slug, userId]);
    conn.release();

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Länk ej hittad eller ingen behörighet' });

    res.json({ message: 'Länk borttagen' });
  } catch (error) {
    res.status(500).json({ message: 'Kunde inte ta bort länk' });
  }
};

module.exports = {
  createLink,
  getMyLinks,
  updateLink,
  deleteLink
};
