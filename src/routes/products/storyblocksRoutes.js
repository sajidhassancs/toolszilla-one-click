/**
 * Storyblocks Routes
 * Product-specific routes for Storyblocks
 */
import express from 'express';
import storyblocksConfig from '../../../products/storyblocks.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyStoryblocksWithPuppeteer,
  proxyStoryblocksStatic,
  proxyStoryblocksCDN,
  proxyStoryblocksContent,
  proxyStoryblocksImages,
  proxyStoryblocksMedia
} from './handlers/storyblockHandlers.js';
import { proxyAssetWithPuppeteer } from './handlers/puppeteerProxy.js';

const router = express.Router();

console.log('🟦 [STORYBLOCKS] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, storyblocksConfig.displayName, 'default');
});

// Asset routes (BEFORE catch-all!)
// Static files
router.use('/static', (req, res) => {
  return proxyStoryblocksStatic(req, res);
});

// CDN files
router.use('/cdn', (req, res) => {
  return proxyStoryblocksCDN(req, res);
});

// Content files
router.use('/content', (req, res) => {
  return proxyStoryblocksContent(req, res);
});

// Images
router.use('/images', (req, res) => {
  return proxyStoryblocksImages(req, res);
});

// Media (videos/audio)
router.use('/media', (req, res) => {
  return proxyStoryblocksMedia(req, res);
});

// CSS files
router.use('/css', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, storyblocksConfig, 'www.storyblocks.com');
});

// JavaScript files
router.use('/js', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, storyblocksConfig, 'www.storyblocks.com');
});

// Font files
router.use('/fonts', (req, res) => {
  return proxyAssetWithPuppeteer(req, res, storyblocksConfig, 'www.storyblocks.com');
});

// Catch-all proxy for ALL other requests (browsing pages)
// This handles everything: /, /video, /audio, /search, etc.
// MUST BE LAST!
router.use((req, res) => {
  return proxyStoryblocksWithPuppeteer(req, res);
});

export default router;