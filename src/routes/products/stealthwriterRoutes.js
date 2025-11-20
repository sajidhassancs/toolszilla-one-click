/**
 * StealthWriter Routes with Queue System
 */
import express from 'express';
import stealthwriterConfig from '../../../products/stealthwriter.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import {
  proxyStealthWriterWithPuppeteer,
  handleHumanizeRequest
} from './handlers/stealthwriterHandlers.js';
import { getQueueStatus, getUserHistory, getUsageStats } from '../../services/stealthWriterQueue.js';

const router = express.Router();

console.log('✍️ [STEALTHWRITER] Router initialized');

// ============================================
// ✅ QUEUE STATUS ENDPOINT
// ============================================
router.get('/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// ✅ HUMANIZE API ENDPOINTS (WITH QUEUE)
// ============================================
router.post('/api/humanize', handleHumanizeRequest);
router.post('/api/humanize/alternatives', handleHumanizeRequest);

// ============================================
// ✅ LIMIT REACHED PAGE
// ============================================
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, stealthwriterConfig.displayName, 'default');
});

// ============================================
// 🎭 CATCH-ALL PROXY (FOR NON-API ROUTES)
// ============================================
router.use((req, res) => {
  console.log('🎯 [STEALTHWRITER] Request:', req.method, req.originalUrl);
  return proxyStealthWriterWithPuppeteer(req, res);
});

// ============================================
// ✅ USER HISTORY ENDPOINT
// ============================================
router.get('/history/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const history = await getUserHistory(email);
    return res.json({ email, history });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// ✅ USAGE STATISTICS ENDPOINTS
// ============================================
// Get stats for all users
router.get('/stats', async (req, res) => {
  try {
    const stats = await getUsageStats(null);
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get stats for specific user
router.get('/stats/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const stats = await getUsageStats(email);
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
export default router;