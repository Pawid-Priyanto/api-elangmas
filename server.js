import express from 'express';
import cors from 'cors';
import { supabase } from './supabase.js'; // Import client yang tadi dibuat
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- ENDPOINT LOGIN ---
// Endpoint Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Meminta Supabase untuk memverifikasi user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Jika sukses, kirim token session ke React
    res.status(200).json({
      message: 'Login Berhasil',
      session: data.session,
      user: data.user
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/me', async (req, res) => {
  // 1. Ambil header authorization
  const authHeader = req.headers.authorization;
  
  // 2. Validasi format Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Format token salah atau tidak ada' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 3. Gunakan auth.getUser(token) untuk verifikasi token JWT dari Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error("Supabase Auth Error:", error.message);
      return res.status(401).json({ message: 'Token tidak valid atau sudah kadaluwarsa' });
    }

    // 4. Jika berhasil, kirim data user
    res.json({
      authenticated: true,
      user: data.user
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ... (tambahkan endpoint upload yang sebelumnya dibuat di sini) ...


// --- KONFIGURASI CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ssb_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
  transformation: [
      { width: 1000, crop: 'limit' }, // Membatasi lebar maksimal 1000px agar tidak terlalu besar
      { quality: 'auto' },            // Mengompres kualitas secara otomatis (AI Cloudinary)
      { fetch_format: 'auto' }         // Mengubah format ke yang paling ringan (misal WebP/Avif)
    ],
});

const upload = multer({ storage: storage });

// --- CRUD PEMAIN (DENGAN FOTO) ---
app.post('/api/pemain', upload.single('foto_url'), async (req, res) => {
  try {
    const { nama, posisi, tanggal_lahir, minutes_play } = req.body;
    const foto_url = req.file ? req.file.path : null;

    const { data, error } = await supabase
      .from('pemain')
      .insert([{ nama, posisi, tanggal_lahir, foto_url, minutes_play: parseInt(minutes_play) || 0 }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pemain', async (req, res) => {
  const { data, error } = await supabase.from('pemain').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json(error);
  res.json(data);
});

// --- CRUD PELATIH (DENGAN FOTO) ---
app.post('/api/pelatih', upload.single('foto_url'), async (req, res) => {
  try {
    const { nama, lisensi } = req.body;
    const foto_url = req.file ? req.file.path : null;

    const { data, error } = await supabase
      .from('pelatih')
      .insert([{ nama, lisensi, foto_url }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pelatih', async (req, res) => {
  const { data, error } = await supabase.from('pelatih').select('*');
  if (error) return res.status(500).json(error);
  res.json(data);
});

// --- CRUD JADWAL PERTANDINGAN (TANPA FOTO) ---
app.post('/api/jadwal', upload.single('foto_url'), async (req, res) => {
  const { lawan, tanggal, lokasi } = req.body;
  const foto_url = req.file ? req.file.path : null;
  const { data, error } = await supabase
    .from('jadwal_pertandingan')
    .insert([{ lawan, tanggal, lokasi, foto_url }])
    .select();

  if (error) return res.status(500).json(error);
  res.status(201).json(data[0]);
});

app.get('/api/jadwal', async (req, res) => {
  const { data, error } = await supabase.from('jadwal_pertandingan').select('*').order('tanggal', { ascending: true });
  if (error) return res.status(500).json(error);
  res.json(data);
});

// --- DELETE DATA (CONTOH PEMAIN) ---
app.delete('/api/pemain/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('pemain').delete().eq('id', id);
  if (error) return res.status(500).json(error);
  res.json({ message: 'Data pemain berhasil dihapus' });
});

const PORT = process.env.PORT || 5000;
// Tambahkan route testing untuk memastikan api jalan
app.get('/', (req, res) => res.send('SSB Elang Mas API is Running!'));
// app.listen(PORT, '0.0.0.0', () => console.log(`Backend SSB running on port ${PORT}`));

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
}

