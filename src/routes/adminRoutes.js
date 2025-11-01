/**
 * Admin Routes
 * Admin operations like cache management
 */
import express from 'express';
import { clearCaches, getCacheStatistics } from '../controllers/adminController.js';

const router = express.Router();

// Clear all caches (requires secret key)
router.get('/cookies-refresh', clearCaches);
router.get('/clear-cache', clearCaches);

// Get cache statistics (requires secret key)
router.get('/cache-stats', getCacheStatistics);

export default router;