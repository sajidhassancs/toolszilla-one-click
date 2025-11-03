/**
 * Flaticon Routes
 * Product-specific routes for Flaticon
 */
import express from 'express';
import flaticonConfig from '../../../products/flaticon.js';
import { handleProxyRequest } from '../../controllers/proxyController.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  processFlatIconPackDownload, 
  processFlatIconIconDownload 
} from './handlers/flaticonHandlers.js';

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

// Catch-all proxy for ALL other requests
// This handles everything: /, /icons, /search, etc.
router.use((req, res) => {
  return handleProxyRequest(req, res, flaticonConfig);
});

export default router;