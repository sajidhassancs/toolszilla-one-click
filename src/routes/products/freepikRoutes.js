/**
 * Freepik Routes
 * Product-specific routes for Freepik
 */
import express from 'express';
import freepikConfig from '../../../products/freepik.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyFreepikWithPuppeteer,
  proxyFreepikAPI,  // ✅ ADD THIS
  proxyFreepikStatic,
  proxyFreepikCDN,
  proxyFreepikCDNB,
  proxyFreepikManifest,
  proxyFreepikImg,
  proxyFreepikImage,
  proxyFreepikAssets,
  proxyFreepikFPS
} from './handlers/freepikHandlers.js';
import { proxyAssetWithPuppeteer } from './handlers/puppeteerProxy.js';

const router = express.Router();

console.log('🎨 [FREEPIK] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, freepikConfig.displayName, 'default');
});

// ============================================
// ✅ API ROUTES (MUST BE FIRST!)
// ============================================

// API calls
router.use('/api', (req, res) => {
  console.log('🔌 [FREEPIK] API route hit:', req.originalUrl);
  return proxyFreepikAPI(req, res);
});

// Manifest
router.get('/manifest.json', (req, res) => {
  console.log('📄 [FREEPIK] Manifest route hit');
  return proxyFreepikManifest(req, res);  // ✅ CHANGED THIS
});

// ============================================
// ✅ STATIC ASSETS (BEFORE CATCH-ALL!)
// ============================================

// Handle /staticfiles/ explicitly
router.use('/staticfiles', (req, res) => {
  console.log('📦 [STATIC FILES] Asset proxy:', req.originalUrl);
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

// Static files
router.use('/static', (req, res) => {
  console.log('🎨 [FREEPIK] Static route hit');
  return proxyFreepikStatic(req, res);
});

// CDN files
router.use('/cdn', (req, res) => {
  console.log('🎨 [FREEPIK] CDN route hit');
  return proxyFreepikCDN(req, res);
});

// CDN B files
router.use('/cdnb', (req, res) => {
  console.log('🎨 [FREEPIK] CDNB route hit');
  return proxyFreepikCDNB(req, res);
});

// Image files (img.freepik.com)
router.use('/img', (req, res) => {
  console.log('🎨 [FREEPIK] Img route hit');
  return proxyFreepikImg(req, res);
});

// Image files (image.freepik.com)
router.use('/image', (req, res) => {
  console.log('🎨 [FREEPIK] Image route hit');
  return proxyFreepikImage(req, res);
});

// Assets
router.use('/assets', (req, res) => {
  console.log('🎨 [FREEPIK] Assets route hit');
  return proxyFreepikAssets(req, res);
});

// FPS (Freepik Premium Service)
router.use('/fps', (req, res) => {
  console.log('🎨 [FREEPIK] FPS route hit');
  return proxyFreepikFPS(req, res);
});

// CSS files
router.use('/css', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

// JavaScript files
router.use('/js', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

// Font files
router.use('/fonts', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

// ============================================
// 🎭 CATCH-ALL FOR HTML PAGES (MUST BE LAST!)
// ============================================
router.use((req, res) => {
  console.log('🎨 [FREEPIK] Catch-all handler triggered');
  console.log('   Method:', req.method);
  console.log('   Path:', req.path);
  console.log('   URL:', req.url);
  console.log('   Original URL:', req.originalUrl);
  
  // ✅ Add this check to see what's actually being requested
  if (req.path === '' || req.path === '/') {
    console.log('   → Root path, loading homepage');
  } else {
    console.log('   → Internal page:', req.path);
  }
  
  return proxyFreepikWithPuppeteer(req, res);
});

// ✅ CRITICAL: Export default router
export default router;