/**
 * Freepik Routes
 * Product-specific routes for Freepik
 */
import express from 'express';
import freepikConfig from '../../../products/freepik.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import {
  proxyFreepikWithPuppeteer,
  proxyFreepikAPI,
  proxyFreepikStatic,
  proxyFreepikCDN,
  proxyFreepikCDNB,
  proxyFreepikManifest,
  proxyFreepikImg,
  proxyFreepikImage,
  proxyFreepikAssets,
  proxyFreepikFPS,
  proxyFreepikStaticCDNPK,

} from './handlers/freepikHandlers.js';
import { proxyAssetWithPuppeteer } from './handlers/puppeteerProxy.js';
import { proxyFreepikWithAxios } from './handlers/freepikAxiosProxy.js';
const router = express.Router();

console.log('🎨 [FREEPIK] Router initialized');
// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, freepikConfig.displayName, 'default');
});

// ============================================
// ✅ API ROUTES (MUST BE FIRST!)
// ============================================
router.use('/pikaso/api', (req, res) => {
  console.log('🎨 [PIKASO API] Route hit:', req.originalUrl);
  return proxyFreepikAPI(req, res);
});

router.use('/api', (req, res) => {
  console.log('🔌 [FREEPIK] API route hit:', req.originalUrl);
  return proxyFreepikAPI(req, res);
});


router.use('/static-cdnpk', (req, res) => {
  return proxyFreepikStaticCDNPK(req, res);
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
router.use('/_next', (req, res) => {
  console.log('📦 [NEXT.JS] Static file:', req.originalUrl);
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

router.use('/staticfiles', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

router.use('/static', (req, res) => {
  return proxyFreepikStatic(req, res);
});

router.use('/cdn', (req, res) => {
  return proxyFreepikCDN(req, res);
});

router.use('/cdnb', (req, res) => {
  return proxyFreepikCDNB(req, res);
});

router.use('/img', (req, res) => {
  return proxyFreepikImg(req, res);
});

router.use('/image', (req, res) => {
  return proxyFreepikImage(req, res);
});

router.use('/assets', (req, res) => {
  return proxyFreepikAssets(req, res);
});

router.use('/fps', (req, res) => {
  return proxyFreepikFPS(req, res);
});

router.use('/css', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

router.use('/js', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

router.use('/fonts', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, freepikConfig, 'www.freepik.com');
});

// ============================================
// 🎭 CATCH-ALL (MUST BE LAST!)
// ============================================
router.use((req, res) => {
  console.log('🎨 [FREEPIK] Catch-all:', req.url);
  return proxyFreepikWithAxios(req, res);  // ← Changed from Puppeteer to Axios
});

export default router;