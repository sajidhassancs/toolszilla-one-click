#!/usr/bin/env node
/**
 * Server Entry Point
 * Starts the Express application
 */
import dotenv from 'dotenv';

// ⚠️ Load environment FIRST
dotenv.config();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 ENVIRONMENT VARIABLES LOADED:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('API_URL:', process.env.API_URL);
console.log('API_KEY:', process.env.API_KEY ? '✅ Set (' + process.env.API_KEY.substring(0, 20) + '...)' : '❌ Missing');
console.log('COOKIE_ENCRYPTION_KEY:', process.env.COOKIE_ENCRYPTION_KEY);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ Set' : '❌ Missing');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Now import app AFTER environment is confirmed loaded
const { default: app } = await import('./src/app.js');

const PORT = parseInt(process.env.PORT || '8224', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MODE = process.env.MODE || 'development';

const server = app.listen(PORT, HOST, async () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('🚀 ToolsZilla One-Click Proxy Server');
  console.log('='.repeat(50));
  console.log(`📍 Environment: ${MODE}`);
  console.log(`🌐 Server running on: http://${HOST}:${PORT}`);
  console.log(`📦 Product: Multi-Product Proxy`);
  console.log(`🎯 Targets: Flaticon, Freepik, StealthWriter, etc.`);
  console.log('='.repeat(50));
  console.log('');
  console.log('✅ Server ready to accept requests');
  console.log('');

  // ✅ Start StealthWriter queue processor (only if Supabase is configured)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 Starting StealthWriter Queue Processor...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const { startQueueProcessor } = await import('./src/services/stealthWriterQueueProcessor.js');

      startQueueProcessor().catch(err => {
        console.error('❌ Queue processor error:', err.message);
        console.error('   Stack:', err.stack);
      });
    } catch (err) {
      console.error('❌ Failed to start queue processor:', err.message);
      console.error('   StealthWriter queue will not be available');
    }
  } else {
    console.log('⚠️  Supabase not configured - StealthWriter queue disabled');
    console.log('   Add SUPABASE_URL and SUPABASE_KEY to enable queue system');
  }
});

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});