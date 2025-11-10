/**
 * Express Application Configuration
 */

// 🔍 DEBUG: Check if environment is loaded when app.js runs
console.log('📦 app.js loading...');
console.log('   COOKIE_ENCRYPTION_KEY in app.js:', process.env.COOKIE_ENCRYPTION_KEY);

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
// 🔍 DEBUG: Log ALL incoming requests before ANY middleware
app.use((req, res, next) => {
  if (req.path.includes('/images/')) {
    console.log('🖼️ [RAW APP.JS] Image request detected:', req.method, req.url, '| Path:', req.path);
  }
  next();
});
// Trust proxy (for getting real IP behind load balancers)
app.set('trust proxy', true);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static HTML views
app.use('/views', express.static(path.join(process.cwd(), 'src', 'views')));

// Static files (cache)
app.use('/static', express.static(path.join(process.cwd(), 'storage', 'cache')));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  console.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;