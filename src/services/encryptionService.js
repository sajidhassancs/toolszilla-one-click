/**
 * Encryption Service
 * Handles encryption and decryption of cookie values
 * Compatible with CryptoJS from frontend
 */
import CryptoJS from 'crypto-js';

// Get key directly from environment (loaded by server.js before this module)
const KEY = process.env.COOKIE_ENCRYPTION_KEY || 'FALLBACK_KEY';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔐 ENCRYPTION SERVICE INITIALIZED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Key from process.env:', process.env.COOKIE_ENCRYPTION_KEY);
console.log('Using KEY constant:', KEY);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * Decrypt cookie value (compatible with CryptoJS from frontend)
 */
export function decryptCookieValue(encryptedValue) {
  try {
    console.log('🔓 Decrypting with key:', KEY);
    
    // Decrypt using CryptoJS (same as frontend)
    const decrypted = CryptoJS.AES.decrypt(encryptedValue, KEY).toString(CryptoJS.enc.Utf8);
    
    if (!decrypted || decrypted.length === 0) {
      throw new Error('Empty decryption result');
    }
    
    console.log('✅ Successfully decrypted');
    return decrypted;
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    console.error('   Value:', encryptedValue.substring(0, 50));
    console.error('   Key:', KEY);
    return encryptedValue;
  }
}

/**
 * Encrypt cookie value (compatible with CryptoJS from frontend)
 */
export function encryptCookieValue(value) {
  try {
    const encrypted = CryptoJS.AES.encrypt(value, KEY).toString();
    console.log('✅ Successfully encrypted');
    return encrypted;
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    return value;
  }
}