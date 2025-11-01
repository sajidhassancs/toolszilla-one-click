/**
 * Auth Controller
 * Handles authentication and session validation
 */
import { decryptUserCookies } from '../services/cookieService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if user session is valid
 */
export async function checkSession(req, res) {
  try {
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.json({
        status: 'redirect',
        redirect_url: userData.redirect
      });
    }

    return res.json({ 
      status: 'ok',
      user_email: userData.user_email,
      product: userData.product
    });
  } catch (error) {
    console.error('❌ Error checking session:', error.message);
    return res.json({
      status: 'error',
      message: 'Session validation failed'
    });
  }
}

/**
 * Show expired session page
 */
export async function showExpiredPage(req, res) {
  try {
    // Get the absolute path to the views directory
    const viewsPath = path.join(process.cwd(), 'src', 'views', 'expired.html');
    
    // Check if file exists
    if (!fs.existsSync(viewsPath)) {
      console.error('❌ expired.html not found at:', viewsPath);
      return res.status(401).send('Session expired. Please log in again.');
    }
    
    return res.sendFile(viewsPath);
  } catch (error) {
    console.error('❌ Error showing expired page:', error.message);
    return res.status(401).send('Session expired. Please log in again.');
  }
}

/**
 * Show access denied page
 */
export async function showAccessDeniedPage(req, res) {
  try {
    const viewsPath = path.join(process.cwd(), 'src', 'views', 'access_denied.html');
    
    if (!fs.existsSync(viewsPath)) {
      console.error('❌ access_denied.html not found at:', viewsPath);
      return res.status(403).send('Access denied.');
    }
    
    return res.sendFile(viewsPath);
  } catch (error) {
    console.error('❌ Error showing access denied page:', error.message);
    return res.status(403).send('Access denied.');
  }
}

/**
 * Root redirect handler
 */
export async function handleRootRedirect(req, res, redirectPath = '/') {
  const accessId = req.query.access_id;

  if (accessId) {
    console.log('Access ID:', accessId);
  }

  return res.redirect(redirectPath);
}