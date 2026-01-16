import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';

const router = express.Router();

// Register (Untuk buat akun pertama kali)
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashed]);
    res.json({ message: "User berhasil dibuat" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0 && await bcrypt.compare(password, result.rows[0].password)) {
      const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      return res.json({ token });
    }
    res.status(401).json({ message: "Salah username/password" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export const proteksi = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).send("Akses ditolak");
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Token tidak valid");
    req.user = user;
    next();
  });
};

// CZ.579kH#r/fqaJ÷
export default router;