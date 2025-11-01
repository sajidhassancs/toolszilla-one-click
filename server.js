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
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Now import app AFTER environment is confirmed loaded
const { default: app } = await import('./src/app.js');

const PORT = parseInt(process.env.PORT || '8224', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MODE = process.env.MODE || 'development';

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('🚀 ToolsZilla One-Click Proxy Server');
  console.log('='.repeat(50));
  console.log(`📍 Environment: ${MODE}`);
  console.log(`🌐 Server running on: http://${HOST}:${PORT}`);
  console.log(`📦 Product: Flaticon`);
  console.log(`🎯 Target: www.flaticon.com`);
  console.log('='.repeat(50));
  console.log('');
  console.log('✅ Server ready to accept requests');
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});