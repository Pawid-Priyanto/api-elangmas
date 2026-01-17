import express from 'express';
import cors from 'cors';
import { supabase } from './supabase.js'; // Import client yang tadi dibuat
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Hanya muat dotenv jika tidak di production (Vercel)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
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

// GET: Fetch Pemain dengan Pagination & Search
app.get('/api/pemain', async (req, res) => {
  try {
    // 1. Ambil query params dari frontend
    // page: halaman ke berapa (mulai dari 1)
    // pageSize: jumlah data per halaman
    // nama: pencarian nama (string)
    // tanggal: pencarian tanggal lahir (YYYY-MM-DD)
    const { page = 1, pageSize = 10, nama = '', tanggal = '' } = req.query;

    // 2. Hitung range untuk Supabase (0-based index)
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 3. Inisialisasi query ke tabel 'pemain'
    // count: 'exact' digunakan untuk mendapatkan total baris data yang sesuai filter
    let query = supabase
      .from('pemain')
      .select('*', { count: 'exact' });

    // 4. Filter: Cari berdasarkan Nama (case-insensitive)
    if (nama) {
      query = query.ilike('nama', `%${nama}%`);
    }

    // 5. Filter: Cari berdasarkan Tanggal Lahir (exact match)
    if (tanggal) {
      query = query.eq('tanggal_lahir', tanggal);
    }

    // 6. Eksekusi query dengan Range (Pagination) dan Order
    const { data, count, error } = await query
      .order('created_at', { ascending: false }) // Urutkan dari yang terbaru
      .range(from, to);

    if (error) throw error;

    // 7. Kirim response terstruktur
    res.json({
      success: true,
      data: data,           // List pemain
      totalData: count,     // Total data keseluruhan setelah difilter
      currentPage: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(count / pageSize)
    });

  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// app.get('/api/pemain', async (req, res) => {
//   const { data, error } = await supabase.from('pemain').select('*').order('created_at', { ascending: false });
//   if (error) return res.status(500).json(error);
//   res.json(data);
// });

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
  try {
    const {page = 1, pageSize= 10, nama = ""} = req.query;

    // hitung range untuk supabase (0-based index)
    const from = (page-1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('pelatih').select('*', {count: 'exact'})

    if(nama){
      query = query.ilike('nama', `%${nama}%`)
    }

    const {data, count, error} = await query.order('created_at', {ascending: false}).range(from,to)

    res.json({
      success: true,
      data: data,
      totalData: count,
      currentPage: parseInt(page),
      totalPages: parseInt(pageSize),
      totalPages: Math.ceil(count / pageSize)
    })

     if (error) throw error;

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
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
  try {
    const { lawan = '' } = req.query;

    // Inisialisasi query
    let query = supabase
      .from('jadwal_pertandingan')
      .select('*');

    // Filter: Cari berdasarkan nama lawan (case-insensitive)
    if (lawan) {
      query = query.ilike('lawan', `%${lawan}%`);
    }

    // Urutkan berdasarkan tanggal terdekat
    const { data, error } = await query.order('tanggal', { ascending: true });

    if (error) throw error;
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// app.get('/api/jadwal', async (req, res) => {
//   const { data, error } = await supabase.from('jadwal_pertandingan').select('*').order('tanggal', { ascending: true });
//   if (error) return res.status(500).json(error);
//   res.json(data);
// });

// --- DELETE DATA (CONTOH PEMAIN) ---
app.delete('/api/pemain/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('pemain').delete().eq('id', id);
  if (error) return res.status(500).json(error);
  res.json({ message: 'Data pemain berhasil dihapus' });
});

// --- DELETE DATA (CONTOH PEMAIN) ---
app.delete('/api/pelatih/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('pelatih').delete().eq('id', id);
  if (error) return res.status(500).json(error);
  res.json({ message: 'Data pemain berhasil dihapus' });
});

// --- DELETE DATA (CONTOH PEMAIN) ---
app.delete('/api/jadwal/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('jadwal_pertandingan').delete().eq('id', id);
  if (error) return res.status(500).json(error);
  res.json({ message: 'Data pemain berhasil dihapus' });
});

// --- EDIT PEMAIN --- //

// PUT: Update Pemain
app.put('/api/pemain/:id', upload.single('foto_url'), async (req, res) => {
  const { id } = req.params;
  const { nama, posisi, tanggal_lahir, minutes_play } = req.body;

  try {
    let updateData = { nama, posisi, tanggal_lahir, minutes_play };

    // Jika admin mengupload foto baru
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'ssb_elangmas/pemain',
      });
      updateData.foto_url = result.secure_url;
    }

    const { data, error } = await supabase
      .from('pemain')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ message: "Data pemain berhasil diperbarui", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- EDIT PELATIH --- //

// PUT: Update Pelatih
app.put('/api/pelatih/:id', upload.single('foto_url'), async (req, res) => {
  const { id } = req.params;
  const { nama, lisensi } = req.body;

  try {
    let updateData = { nama, lisensi };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'ssb_elangmas/pelatih',
      });
      updateData.foto_url = result.secure_url;
    }

    const { data, error } = await supabase
      .from('pelatih')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ message: "Data pelatih berhasil diperbarui", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- EDIT JADWAL --- //

// PUT: Update Jadwal
app.put('/api/jadwal/:id', async (req, res) => {
  const { id } = req.params;
  const { lawan, tanggal, jam, lokasi, tipe_pertandingan } = req.body;

  try {
    const { data, error } = await supabase
      .from('jadwal_pertandingan')
      .update({ lawan, tanggal, jam, lokasi, tipe_pertandingan })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ message: "Jadwal berhasil diperbarui", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
// Tambahkan route testing untuk memastikan api jalan
app.get('/', (req, res) => res.send('SSB Elang Mas API is Running!'));
// app.listen(PORT, '0.0.0.0', () => console.log(`Backend SSB running on port ${PORT}`));

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
}

export default app;