import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import './db/connection'; // Initialize database connection

// Import routes
import authRoutes from './routes/auth';
import companyRoutes from './routes/companies';
import sectionRoutes from './routes/sections';
import jobRoutes from './routes/jobs';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Careers Page Builder API', 
    status: 'running',
    version: '1.0.0' 
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/companies', sectionRoutes);
app.use('/api/companies', jobRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
