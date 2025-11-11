/**
 * Epidemic Sound Routes
 * Product-specific routes for Epidemic Sound
 */
import express from 'express';
import epidemicsoundConfig from '../../../products/epidemicsound.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyEpidemicsoundWithPuppeteer,
  proxyEpidemicsoundStatic,
  proxyEpidemicsoundCDN,
  proxyEpidemicsoundAssets,
  proxyEpidemicsoundImages,
  proxyEpidemicsoundMedia
} from './handlers/epidemicsoundHandlers.js';
import { proxyAssetWithPuppeteer } from './handlers/puppeteerProxy.js';

const router = express.Router();

console.log('🎵 [EPIDEMIC SOUND] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, epidemicsoundConfig.displayName, 'default');
});

// ============================================
// ✅ STATIC ASSETS (BEFORE CATCH-ALL!)
// ============================================

// 🔥 NEW: Handle /staticfiles/ explicitly
router.use('/staticfiles', (req, res) => {
  console.log('📦 [STATIC FILES] Asset proxy:', req.originalUrl);
  return proxyAssetWithPuppeteer(req, res, epidemicsoundConfig, 'www.epidemicsound.com');
});

// Static files
router.use('/static', (req, res) => {
  return proxyEpidemicsoundStatic(req, res);
});

// CDN files
router.use('/cdn', (req, res) => {
  return proxyEpidemicsoundCDN(req, res);
});

// Assets
router.use('/assets', (req, res) => {
  return proxyEpidemicsoundAssets(req, res);
});

// Images
router.use('/images', (req, res) => {
  return proxyEpidemicsoundImages(req, res);
});

// Media (audio files)
router.use('/media', (req, res) => {
  return proxyEpidemicsoundMedia(req, res);
});

// CSS files
router.use('/css', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, epidemicsoundConfig, 'www.epidemicsound.com');
});

// JavaScript files
router.use('/js', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, epidemicsoundConfig, 'www.epidemicsound.com');
});

// Font files
router.use('/fonts', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, epidemicsoundConfig, 'www.epidemicsound.com');
});

// ============================================
// 🎭 CATCH-ALL FOR HTML PAGES (MUST BE LAST!)
// ============================================
router.use((req, res) => {
  console.log('🎵 [EPIDEMIC SOUND] Catch-all handler triggered');
  return proxyEpidemicsoundWithPuppeteer(req, res);
});

// ✅ CRITICAL: Export default router
export default router;