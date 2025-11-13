/**
 * StealthWriter Routes
 * Product-specific routes for StealthWriter
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
// 🎭 CATCH-ALL PROXY - Handles EVERYTHING
// ============================================
// This single handler manages:
// - Homepage (/)
// - All pages (/ai-detector, /contact, etc.)
// - Next.js assets (/_next/static/...)
// - API calls (/api/...)
// - Static files (/images/, /css/, /js/, etc.)
// - Logo and icons (/*.svg, /*.png, etc.)
router.use((req, res) => {
  console.log('🎯 [STEALTHWRITER] Request:', req.method, req.originalUrl);
  return proxyStealthWriterWithPuppeteer(req, res);
});

export default router;