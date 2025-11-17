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
const router = express.Router();

console.log('🟦 [STORYBLOCKS] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, storyblocksConfig.displayName, 'default');
});

// CDN ASSET ROUTES (These can use Axios - no auth needed)
router.use('/static', proxyStoryblocksStatic);
router.use('/cdn', proxyStoryblocksCDN);
router.use('/content', proxyStoryblocksContent);
router.use('/images', proxyStoryblocksImages);
router.use('/media', proxyStoryblocksMedia);


router.get(/^\/breadcrumbs\/(.*)$/, async (req, res) => {
  try {
    const assetPath = '/' + req.params[0];
    const targetUrl = `https://breadcrumbs.storyblocks.com${assetPath}`;

    console.log('🎨 Proxying breadcrumbs asset:', targetUrl);

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
    console.error('❌ Error proxying breadcrumbs:', error.message);
    return res.status(500).send('Failed to proxy asset');
  }
});
// EVERYTHING ELSE uses Puppeteer
// This includes: /, /api, /resources, /wp-content, /wp-includes, /css, /js, /fonts
// Storyblocks has CloudFlare protection - must use Puppeteer for all authenticated requests
router.use((req, res) => {
  return proxyStoryblocksWithPuppeteer(req, res);
});

export default router;