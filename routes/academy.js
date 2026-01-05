import express from 'express';
import { query } from '../db.js';
import { proteksi } from './auth.js';

const router = express.Router();

// PEMAIN
router.get('/pemain', async (req, res) => {
  const result = await query('SELECT * FROM pemain');
  res.json(result.rows);
});

router.post('/pemain', proteksi, async (req, res) => {
  const { nama, posisi, batch } = req.body;
  await query('INSERT INTO pemain (nama, posisi, batch) VALUES ($1, $2, $3)', [nama, posisi, batch]);
  res.json({ message: "Pemain berhasil ditambah" });
});

// PELATIH
router.get('/pelatih', async (req, res) => {
  const result = await query('SELECT * FROM pelatih');
  res.json(result.rows);
});

export default router;