/**
 * TurnDetect Routes
 * Product-specific routes for TurnDetect
 */
import express from 'express';
import turndetectConfig from '../../../products/turndetect.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyTurnDetectWithAxios
} from './handlers/turndetectHandlers.js';

const router = express.Router();

console.log('🔍 [TURNDETECT] Router initialized');

// ============================================
// ✅ LIMIT REACHED PAGE
// ============================================
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, turndetectConfig.displayName, 'default');
});

// ============================================
// 🎭 CATCH-ALL PROXY - Handles EVERYTHING
// ============================================
router.use((req, res) => {
  console.log('🎯 [TURNDETECT] Request:', req.method, req.originalUrl);
  return proxyTurnDetectWithAxios(req, res);
});

export default router;