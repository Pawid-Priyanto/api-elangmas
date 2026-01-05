import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import academyRoutes from './routes/academy.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api', academyRoutes);

app.listen(5000, () => console.log("Server PFA lari di port 5000"));