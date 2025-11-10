import express from 'express';
import { 
  proxyVecteezyWithPuppeteer,  // ✅ ADD THIS
  proxyVecteezyStatic, 
  proxyVecteezyCDN,
  proxyVecteezyImages 
} from './handlers/vecteezyHandlers.js';

const router = express.Router();

console.log('🟣 [VECTEEZY] Router initialized');

// Logging middleware
router.use((req, res, next) => {
  console.log('\n========================================');
  console.log('🟣 [VECTEEZY ROUTER] Incoming request');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Path:', req.path);
  console.log('   Original URL:', req.originalUrl);
  console.log('   Base URL:', req.baseUrl);
  console.log('========================================\n');
  next();
});

// Static assets
router.use('/static', proxyVecteezyStatic);
console.log('✅ [VECTEEZY] Registered /static route');

// CDN assets
router.use('/cdn', proxyVecteezyCDN);
console.log('✅ [VECTEEZY] Registered /cdn route');

// Images
router.use('/images', proxyVecteezyImages);
console.log('✅ [VECTEEZY] Registered /images route');

// ✅ USE PUPPETEER for main browsing (bypasses bot detection)
router.use('/', proxyVecteezyWithPuppeteer);
console.log('✅ [VECTEEZY] Registered catch-all route (Puppeteer)');

export default router;