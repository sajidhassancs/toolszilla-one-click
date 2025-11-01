/**
 * Admin Controller
 * Handles admin operations like cache management
 */
import { clearAllCaches, getCacheStats } from '../services/cacheService.js';
import { TOOL_COOKIES_RESET_KEY } from '../utils/constants.js';

/**
 * Clear all caches (requires secret key)
 */
export async function clearCaches(req, res) {
  try {
    const key = req.query.key;

    if (!key || key !== TOOL_COOKIES_RESET_KEY) {
      console.warn('⚠️  Invalid cache reset key attempt');
      return res.status(403).json({ 
        status: 'error', 
        message: 'Invalid key' 
      });
    }

    clearAllCaches();

    console.log('✅ All caches cleared by admin');

    return res.json({ 
      status: 'ok',
      message: 'All caches cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing caches:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to clear caches'
    });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStatistics(req, res) {
  try {
    const key = req.query.key;

    if (!key || key !== TOOL_COOKIES_RESET_KEY) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Invalid key' 
      });
    }

    const stats = getCacheStats();

    return res.json({
      status: 'ok',
      cache_stats: stats
    });
  } catch (error) {
    console.error('❌ Error getting cache stats:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get cache statistics'
    });
  }
}