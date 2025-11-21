/**
 * Freepik Routes - WITH PIKASO SUPPORT
 */
import express from 'express';
import freepikConfig from '../../../products/freepik.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import {
  proxyFreepikAPI,
  proxyFreepikStatic,
  proxyFreepikCDN,
  proxyFreepikCDNB,
  proxyFreepikManifest,
  proxyFreepikImg,
  proxyFreepikImage,
  proxyFreepikAssets,
  proxyFreepikFPS,
  proxyFreepikStaticCDNPK
} from './handlers/freepikHandlers.js';
import { proxyFreepikWithAxios } from './handlers/freepikAxiosProxy.js';

const router = express.Router();

console.log('🎨 [FREEPIK] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, freepikConfig.displayName, 'default');
});

// ============================================
// ✅ PIKASO ROUTES (MUST BE FIRST!)
// ============================================
router.use('/pikaso', (req, res) => {
  console.log('🎨 [PIKASO] Route hit:', req.originalUrl);
  return proxyFreepikWithAxios(req, res);
});

// ============================================
// ✅ WEPIK ROUTES
// ============================================
router.use('/wepik', (req, res) => {
  console.log('🎨 [WEPIK] Route hit:', req.originalUrl);
  return proxyFreepikWithAxios(req, res);
});

// ============================================
// ✅ SLIDESGO ROUTES
// ============================================
router.use('/slidesgo', (req, res) => {
  console.log('🎨 [SLIDESGO] Route hit:', req.originalUrl);
  return proxyFreepikWithAxios(req, res);
});

// ============================================
// ✅ API ROUTES
// ============================================
router.use('/api', (req, res) => {
  console.log('🔌 [FREEPIK API] Route hit:', req.originalUrl);
  return proxyFreepikAPI(req, res);
});

// Manifest
router.get('/manifest.json', (req, res) => {
  console.log('📄 [FREEPIK] Manifest route hit');
  return proxyFreepikManifest(req, res);
});

// ============================================
// ✅ BLOCK CDN-CGI
// ============================================
router.all(/^\/cdn-cgi\/.*$/, (req, res) => {
  console.log('🚫 [FREEPIK] Blocking cdn-cgi');
  return res.status(200).json({ success: true });
});

// ============================================
// ✅ STATIC ASSETS
// ============================================
router.use('/static-cdnpk', proxyFreepikStaticCDNPK);
router.use('/static', proxyFreepikStatic);
router.use('/cdn', proxyFreepikCDN);
router.use('/cdnb', proxyFreepikCDNB);
router.use('/img', proxyFreepikImg);
router.use('/image', proxyFreepikImage);
router.use('/assets', proxyFreepikAssets);
router.use('/fps', proxyFreepikFPS);

// ✅ NEXT.JS ROUTES
// ============================================
router.use('/_next', (req, res) => {
  console.log('📦 [NEXT.JS] Route hit:', req.originalUrl);
  return proxyFreepikWithAxios(req, res);
});

// ============================================
// 🎭 CATCH-ALL (Use Axios with cookies!)
// ============================================
router.use((req, res) => {
  console.log('🎨 [FREEPIK] Catch-all:', req.url);
  return proxyFreepikWithAxios(req, res);
});

export default router;