/**
 * StealthWriter Routes
 */
import express from 'express';
import stealthwriterConfig from '../../../products/stealthwriter.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import {
  proxyStealthWriterWithPuppeteer
} from './handlers/stealthwriterHandlers.js';

const router = express.Router();

console.log('✍️ [STEALTHWRITER] Router initialized');

// ============================================
// ✅ LIMIT REACHED PAGE
// ============================================
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, stealthwriterConfig.displayName, 'default');
});

// ============================================
// 🎭 CATCH-ALL PROXY
// ============================================
router.use((req, res) => {
  console.log('🎯 [STEALTHWRITER] Request:', req.method, req.originalUrl);
  return proxyStealthWriterWithPuppeteer(req, res);
});

export default router;