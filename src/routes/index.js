/**
 * Main Router
 * Combines all route modules
 */
import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import flaticonRoutes from './products/flaticonRoutes.js';
import envatoRoutes from './products/envatoRoutes.js';
import vecteezyRoutes from './products/vecteezy.js';
import storyblocksRoutes from './products/storyblocksRoutes.js';
import iconscoutRoutes from './products/iconscoutRoutes.js';
import epidemicsoundRoutes from './products/epidemicsoundRoutes.js';
import freepikRoutes from './products/freepikRoutes.js';
import { handleMediaProxy } from '../controllers/proxyController.js';
import { showLimitReachedPage } from '../controllers/downloadController.js';
import flaticonConfig from '../../products/flaticon.js';
 import pikbestRoutes from './products/pikbestRoutes.js';
const router = express.Router();

// ✅ LOG EVERY REQUEST TO MAIN ROUTER
router.use((req, res, next) => {
  console.log('🔴 [MAIN ROUTER] Request:', req.method, req.url);
  next();
});

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
    secure: false,
    maxAge: 3600000,
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
  
  const productName = product || 'flaticon';
  console.log(`🔀 Redirecting to: /${productName}`);

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

// ============================================
// LIMIT REACHED PAGE (GLOBAL)
// ============================================
router.get('/limit-reached', (req, res) => {
  const productName = req.query.product || 'Flaticon';
  const planType = req.query.plan || 'default';
  console.log(`⚠️ Showing limit reached page for ${productName} (${planType} plan)`);
  return showLimitReachedPage(req, res, productName, planType);
});

// Auth routes
router.use('/', authRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Media proxy routes (MUST BE BEFORE PRODUCT ROUTES)
router.use('/media', (req, res) => {
  return handleMediaProxy(req, res, flaticonConfig, 'media.flaticon.com');
});

// ============================================
// ✅ VECTEEZY API CATCH-ALL
// ============================================
router.use('/async_contributors_info', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /async_contributors_info to /vecteezy');
  return res.redirect(307, `/vecteezy${req.url}`);
});

router.use('/api/v2', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /api/v2 to /vecteezy');
  return res.redirect(307, `/vecteezy${req.url}`);
});

router.get('/account', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /account to /vecteezy');
  return res.redirect(307, '/vecteezy/account');
});

router.get('/site.webmanifest', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /site.webmanifest to /vecteezy');
  return res.redirect(307, '/vecteezy/site.webmanifest');
});

// ============================================
// ✅ ENVATO CATCH-ALL ROUTES
// ============================================
router.use('/data-api', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /data-api to /envato/data-api');
  return res.redirect(307, `/envato${req.url}`);
});

router.use('/elements-api', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /elements-api to /envato/elements-api');
  return res.redirect(307, `/envato${req.url}`);
});

router.get('/manifest.webmanifest', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /manifest.webmanifest to /envato/manifest.webmanifest');
  return res.redirect(307, '/envato/manifest.webmanifest');
});

// ============================================
// ✅ ICONSCOUT API CATCH-ALL
// ============================================
router.use('/strapi', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /strapi to /iconscout/strapi');
  return res.redirect(307, `/iconscout${req.url}`);
});

router.use('/cdn-cgi', (req, res) => {
  console.log('🔀 [ROOT] Redirecting /cdn-cgi to /iconscout/cdn-cgi');
  return res.redirect(307, `/iconscout${req.url}`);
});

router.get('/manifest.json', (req, res, next) => {
  // Check referer to determine which product
  const referer = req.headers.referer || '';
  
  if (referer.includes('/iconscout')) {
    console.log('🔀 [ROOT] Redirecting /manifest.json to /iconscout/manifest.json');
    return res.redirect(307, '/iconscout/manifest.json');
  }
  
  next(); // Let other routes handle it
});

// ============================================
// STATIC JSON RESPONSES (for compatibility)
// ============================================
router.get('/elements-api/user_collections.json', (req, res) => {
  console.log('📄 Serving static user_collections.json');
  return res.json({ data: [] });
});

router.get('/elements-api/infrastructure_availability.json', (req, res) => {
  console.log('📄 Serving static infrastructure_availability.json');
  return res.json({
    market: { available: true, scheduledMaintenance: false },
    identity: { available: true, scheduledMaintenance: false },
    rss: { available: true, scheduledMaintenance: false },
    area51: { available: true, scheduledMaintenance: false }
  });
});

// ============================================
// PRODUCT ROUTES (MUST BE LAST)
// ============================================
router.use('/flaticon', flaticonRoutes);
console.log('✅ Registered /flaticon route');

router.use('/envato', envatoRoutes);
console.log('✅ Registered /envato route');

router.use('/vecteezy', vecteezyRoutes);
console.log('✅ Registered /vecteezy route');

router.use('/storyblocks', storyblocksRoutes);
console.log('✅ Registered /storyblocks route');

router.use('/epidemicsound', epidemicsoundRoutes);
console.log('✅ Registered /epidemicsound route');

router.use('/freepik', freepikRoutes);
console.log('✅ Registered /freepik route');

router.use('/iconscout', iconscoutRoutes);
console.log('✅ Registered /iconscout route');
 
router.use('/pikbest', pikbestRoutes);
console.log('✅ Registered /pikbest route');
export default router;