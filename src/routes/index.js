/**
 * Main Router
 * Combines all route modules
 */
import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import flaticonRoutes from './products/flaticonRoutes.js';

const router = express.Router();

// ============================================
// SETUP SESSION ENDPOINT (MUST BE FIRST!)
// ============================================
router.get('/setup-session', (req, res) => {
  console.log('🔧 Setting up session');
  console.log('📥 Query params:', req.query);
  
  const {
    auth_token,
    prefix,
    product,
    site,
    user_email,
    ttl
  } = req.query;

  // Validate
  if (!auth_token || !prefix || !product || !site) {
    console.error('❌ Missing required parameters');
    return res.status(400).json({ 
      error: 'Missing required parameters',
      required: ['auth_token', 'prefix', 'product', 'site'],
      received: Object.keys(req.query)
    });
  }

  console.log('✅ All parameters present');

  // Cookie options
  const cookieOptions = {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    maxAge: 3600000, // 1 hour
    path: '/',
    sameSite: 'lax'
  };

  // Set cookies
  console.log('🍪 Setting cookies...');
  res.cookie('auth_token', auth_token, cookieOptions);
  res.cookie('prefix', prefix, cookieOptions);
  res.cookie('product', product, cookieOptions);
  res.cookie('site', site, cookieOptions);
  res.cookie('ttl', ttl || Math.floor(Date.now() / 1000).toString(), cookieOptions);
  
  if (user_email) {
    res.cookie('user_email', user_email, cookieOptions);
  }

  console.log('✅ Cookies set successfully');
  
  // Use product name for redirect (not prefix which is user identifier)
  const productName = product || 'flaticon';
  console.log(`🔀 Redirecting to: /${productName}`);

  // Redirect to product
  return res.redirect(`/${productName}`);
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'ToolsZilla One-Click',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
router.use('/', authRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Product routes (MUST BE LAST)
router.use('/flaticon', flaticonRoutes);

export default router;