import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// SPEC 6.1: Validate ADMIN_ROUTE_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_ROUTE_SECRET) {
    console.error('❌ FATAL: ADMIN_ROUTE_SECRET environment variable is required in production');
    console.error('   Set this to a random secret string to secure admin routes.');
    process.exit(1);
}

// Import routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import creditsRoutes from './routes/credits.js';
import configRoutes from './routes/config.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';
import listsRoutes from './routes/lists.js';
import exportsRoutes from './routes/exports.js';
import billingRoutes from './routes/billing.js';
import profileRoutes from './routes/profile.js';

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
// SPEC 6.1: Explicitly disable /api/admin - always return 404
app.use('/api/admin', (req, res) => res.status(404).json({ error: 'Not Found' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/config', configRoutes);
// SPEC 6.1: Admin routes mounted at secret path (old /api/admin is disabled - returns 404)
if (process.env.ADMIN_ROUTE_SECRET) {
    app.use(`/api/${process.env.ADMIN_ROUTE_SECRET}/admin`, adminRoutes);
}
app.use('/api/search', searchRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/profile', profileRoutes);


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
            config: '/api/config',
            search: '/api/search',
            lists: '/api/lists',
            exports: '/api/exports'
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
            '/api/config/auth',
            '/api/search',
            '/api/search/sessions',
            '/api/lists',
            '/api/lists/:listId',
            '/api/lists/:listId/items',
            '/api/lists/:listId/items/:itemId/enrich',
            '/api/exports',
            '/api/exports/:exportId/download'
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
  - POST /api/search
  - GET  /api/search/sessions
  - GET  /api/lists
  - POST /api/lists
  - GET  /api/lists/:listId/items
  - POST /api/lists/:listId/items
  - POST /api/lists/:listId/items/:itemId/enrich
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
