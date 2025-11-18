/**
 * Storyblocks Routes
 */
import express from 'express';
import axios from 'axios';
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

const router = express.Router();

console.log('🟦 [STORYBLOCKS] Router initialized');

// Logging middleware
router.use((req, res, next) => {
  console.log('\n========================================');
  console.log('🟦 [STORYBLOCKS] Request:', req.method, req.originalUrl);
  console.log('========================================\n');
  next();
});

// CORS
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, storyblocksConfig.displayName, 'default');
});

// CDN ASSET ROUTES - Must be BEFORE catch-all
router.use('/static', proxyStoryblocksStatic);
router.use('/cdn', proxyStoryblocksCDN);
router.use('/content', proxyStoryblocksContent);

// ✅ ONLY proxy actual image files, not /images/search
router.use(/^\/images\/.*\.(jpg|jpeg|png|gif|webp|svg)/, proxyStoryblocksImages);

// ✅ ONLY proxy actual media files, not /media/search
router.use(/^\/media\/.*\.(mp4|webm|mov|avi|mp3|wav|ogg)/, proxyStoryblocksMedia);

// Breadcrumbs
router.get(/^\/breadcrumbs\/(.*)$/, async (req, res) => {
  try {
    const assetPath = '/' + req.params[0];
    const targetUrl = `https://breadcrumbs.storyblocks.com${assetPath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Referer': 'https://www.storyblocks.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Breadcrumbs error:', error.message);
    return res.status(500).send('Failed');
  }
});

// ✅ EVERYTHING ELSE uses Puppeteer (including /images/search, /video/search, etc.)
router.use('/', proxyStoryblocksWithPuppeteer);

export default router;