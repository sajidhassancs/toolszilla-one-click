/**
 * Flaticon Routes
 * Product-specific routes for Flaticon
 */
import express from 'express';
import flaticonConfig from '../../../products/flaticon.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  processFlatIconPackDownload, 
  processFlatIconIconDownload,
  proxyFlaticonWithPuppeteer
} from './handlers/flaticonHandlers.js';
// ✅ ADD THIS IMPORT
import { proxyAssetWithPuppeteer } from './handlers/puppeteerProxy.js';

const router = express.Router();

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, flaticonConfig.displayName, 'default');
});

// Pack download (POST) - with limit check
router.post('/download-pack', processFlatIconPackDownload);

router.use('/download-pack', (req, res, next) => {
  if (req.method === 'POST') {
    return processFlatIconPackDownload(req, res);
  }
  next();
});

// Individual icon download (GET) - no limit check
router.use('/download/icon', (req, res) => {
  return processFlatIconIconDownload(req, res);
});

// ✅ ADD THESE ASSET ROUTES (BEFORE catch-all!)
// CSS files
router.use('/css', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, flaticonConfig, 'www.flaticon.com');
});

// JavaScript files
router.use('/js', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, flaticonConfig, 'www.flaticon.com');
});

// Static files
router.use('/static', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, flaticonConfig, 'www.flaticon.com');
});

// Image files from CDN
router.use('/img', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, flaticonConfig, 'cdn-icons-png.flaticon.com');
});

// Regular images
router.use('/images', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, flaticonConfig, 'www.flaticon.com');
});

// Font files
router.use('/fonts', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, flaticonConfig, 'www.flaticon.com');
});

// Catch-all proxy for ALL other requests (browsing pages)
// This handles everything: /, /icons, /search, etc.
// MUST BE LAST!
router.use((req, res) => {
  return proxyFlaticonWithPuppeteer(req, res);
});

export default router;