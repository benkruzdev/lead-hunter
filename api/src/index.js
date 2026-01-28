import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import creditsRoutes from './routes/credits.js';
import configRoutes from './routes/config.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';
import listsRoutes from './routes/lists.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/lists', listsRoutes);


// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'LeadHunter API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            credits: '/api/credits',
            config: '/api/config'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        availableEndpoints: [
            '/api/health',
            '/api/health/ready',
            '/api/auth/profile',
            '/api/auth/verify',
            '/api/credits/balance',
            '/api/credits/history',
            '/api/credits/deduct',
            '/api/config/auth'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║      LeadHunter API Server             ║
╚════════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📡 Health check: http://localhost:${PORT}/api/health

Available endpoints:
  - GET  /api/health
  - GET  /api/health/ready
  - GET  /api/auth/profile
  - PATCH /api/auth/profile
  - POST /api/auth/verify
  - GET  /api/credits/balance
  - GET  /api/credits/history
  - POST /api/credits/deduct
  - GET  /api/config/auth
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
