/**
 * Main Router - FIXED AUTO-ROUTER
 * Prevents double prefixing issue
 */
import express from 'express';
import axios from 'axios';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import flaticonRoutes from './products/flaticonRoutes.js';
import envatoRoutes from './products/envatoRoutes.js';
import vecteezyRoutes from './products/vecteezy.js';
import storyblocksRoutes from './products/storyblocksRoutes.js';
import iconscoutRoutes from './products/iconscoutRoutes.js';
import epidemicsoundRoutes from './products/epidemicsoundRoutes.js';
import freepikRoutes from './products/freepikRoutes.js';
import pikbestRoutes from './products/pikbestRoutes.js';
import { handleMediaProxy } from '../controllers/proxyController.js';
import { showLimitReachedPage } from '../controllers/downloadController.js';
import { decryptUserCookies, decryptUserCookiesNoSessionCheck } from '../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../services/apiService.js';
import flaticonConfig from '../../products/flaticon.js';
import stealthwriterRoutes from './products/stealthwriterRoutes.js';
import turndetectRoutes from './products/turndetectRoutes.js';
const router = express.Router();

// ✅ LOG EVERY REQUEST (MUST BE FIRST!)
router.use((req, res, next) => {
  console.log('🔴 [MAIN ROUTER] Request:', req.method, req.url);
  next();
});

// ============================================
// SETUP SESSION ENDPOINT
// ============================================
router.get('/setup-session', (req, res) => {
  console.log('🔧 Setting up session');
  console.log('📥 Query params:', req.query);
  
  const {
    auth_token,
    prefix,
    product,
    site,
    user_email,
    ttl
  } = req.query;

  if (!auth_token || !prefix || !product || !site) {
    console.error('❌ Missing required parameters');
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Session Setup Required</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; }
          .error { background: #fee; border: 2px solid #f00; padding: 20px; border-radius: 8px; }
          h1 { color: #c00; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>⚠️ Session Setup Error</h1>
          <p><strong>Your session has expired or is invalid.</strong></p>
          <p>Please go back to your ToolsZilla dashboard and click the "One-Click Access" button again.</p>
        </div>
      </body>
      </html>
    `);
  }

  console.log('✅ All parameters present');

  // ✅ DETECT LOCALHOST vs PRODUCTION
  const isLocalhost = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
  
  const cookieOptions = {
    httpOnly: true,
    secure: !isLocalhost,
    maxAge: 3600000,
    path: '/',
    sameSite: isLocalhost ? 'lax' : 'none',
    ...(isLocalhost ? {} : { domain: '.primewp.net' })
  };

  console.log('🍪 Setting cookies with options:', cookieOptions);
  res.cookie('auth_token', auth_token, cookieOptions);
  res.cookie('prefix', prefix, cookieOptions);
  res.cookie('product', product, cookieOptions);
  res.cookie('site', site, cookieOptions);
  res.cookie('ttl', ttl || Math.floor(Date.now() / 1000).toString(), cookieOptions);
  
  if (user_email) {
    res.cookie('user_email', user_email, cookieOptions);
  }

  console.log('✅ Cookies set successfully');
  
const productName = product || 'flaticon';

// ✅ Special handling for Epidemic Sound & Envato - redirect to root path
if (productName === 'epidemicsound') {
  console.log(`🔀 Redirecting to: /music/featured/ (Epidemic Sound - no prefix)`);
  return res.redirect('/music/featured/?override_referrer=');
} else if (productName === 'envato') {
  console.log(`🔀 Redirecting to: / (Envato homepage - no prefix)`);
  return res.redirect('/');
} else if (productName === 'freepik') {
  console.log(`🔀 Redirecting to: / (Freepik homepage - no prefix)`);
  return res.redirect('/');
} else {
  console.log(`🔀 Redirecting to: /${productName}`);
  return res.redirect(`/${productName}`);
}
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'ToolsZilla One-Click',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ✅ MANIFEST.JSON - SMART ROUTER
// ============================================
router.get('/manifest.json', (req, res) => {
  const referer = req.headers.referer || '';
  
  console.log('📱 [MANIFEST] Request');
  console.log('   Referer:', referer);
  console.log('   Cookies:', req.cookies);
  
  // Check if request is from Iconscout
  if (referer.includes('/iconscout') || req.cookies.product === 'iconscout') {
    console.log('   ✅ Returning Iconscout manifest');
    return res.status(200).json({
      name: "Iconscout",
      short_name: "Iconscout",
      start_url: "/iconscout/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#000000",
      icons: []
    });
  }
  
  // Default manifest
  console.log('   ✅ Returning default manifest');
  return res.status(200).json({
    name: "ToolsZilla",
    short_name: "ToolsZilla",
    start_url: "/",
    display: "standalone",
    icons: []
  });
});

// ============================================
// ✅ CLOUDFLARE CDN-CGI ROUTES AT ROOT LEVEL
// ============================================
router.all('/cdn-cgi/rum', (req, res) => {
  return res.status(200).json({ success: true });
});

router.all(/^\/cdn-cgi\/.*$/, (req, res) => {
  return res.status(200).json({ success: true });
});

// ============================================
// LIMIT REACHED PAGE
// ============================================
router.get('/limit-reached', (req, res) => {
  const productName = req.query.product || 'Flaticon';
  const planType = req.query.plan || 'default';
  console.log(`⚠️ Showing limit reached page for ${productName} (${planType} plan)`);
  return showLimitReachedPage(req, res, productName, planType);
});

// ============================================
// ✅ CDN ROUTES WITH /image PREFIX (MUST BE BEFORE /iconscout PRODUCT ROUTE!)
// ============================================

// ✅ CDNA Route - FIXED TO WORK WITHOUT COOKIES
router.get(/^\/iconscout\/image\/cdna\/(.*)$/, async (req, res) => {
  const cdnPath = req.params[0];
  const cdnUrl = `https://cdna.iconscout.com/${cdnPath}`;
  
  console.log('\n========== CDNA REQUEST ==========');
  console.log('🎨 [CDNA] Request:', cdnUrl);
  console.log('   📋 File:', cdnPath);
  
  try {
    const returnFallback = (reason) => {
      console.log('   ❌ Fallback:', reason);
      if (cdnPath.endsWith('.js')) {
        res.set('Content-Type', 'application/javascript');
        return res.status(200).send('console.error("CDNA: ' + reason + '");');
      }
      const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      return res.status(200).send(pixel);
    };

    let cookieString = '';
    
    try {
      if (req.cookies.auth_token && req.cookies.prefix) {
        const userData = await decryptUserCookiesNoSessionCheck(req);
        if (!userData.redirect) {
          const apiData = await getDataFromApiWithoutVerify(userData.prefix);
          let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
          
          if (typeof cookiesArray === 'string') {
            cookiesArray = JSON.parse(cookiesArray);
          }
          
          cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');
          console.log('   🍪 Got', cookiesArray.length, 'premium cookies');
        } else {
          console.log('   ⚠️ Invalid session - continuing without auth');
        }
      } else {
        console.log('   ⚠️ No auth cookies - trying without authentication');
      }
    } catch (cookieError) {
      console.log('   ⚠️ Cookie error:', cookieError.message, '- continuing without auth');
    }

    const acceptHeader = cdnPath.endsWith('.js') ? 'application/javascript, */*' 
      : cdnPath.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) ? 'image/*,*/*'
      : cdnPath.endsWith('.css') ? 'text/css,*/*'
      : cdnPath.match(/\.(woff|woff2|ttf|eot)$/i) ? 'font/*,*/*'
      : '*/*';

    console.log('   🌐 Fetching...');
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': acceptHeader,
      'Referer': 'https://iconscout.com/'
    };
    
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }
    
    const response = await axios.get(cdnUrl, {
      headers: headers,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   📊 Response:', response.status, response.headers['content-type'], response.data.length, 'bytes');
    
    if (response.status === 403 || response.status === 404 || response.data.length === 0) {
      return returnFallback('CDN ' + response.status);
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    console.log('   ✅ SUCCESS\n');
    return res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error('   ❌ EXCEPTION:', error.message, '\n');
    if (cdnPath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
      return res.status(200).send('console.error("Exception");');
    }
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    return res.status(200).send(pixel);
  }
});

// ✅ CDN3D Route
router.get(/^\/iconscout\/image\/cdn3d\/(.*)$/, async (req, res) => {
  try {
    const cdnPath = req.params[0];
    const cdnUrl = `https://cdn3d.iconscout.com/${cdnPath}`;
    
    console.log('🎨 [CDN3D] Request:', cdnUrl);
    
    let cookieString = '';
    
    try {
      if (req.cookies.auth_token && req.cookies.prefix) {
        const userData = await decryptUserCookiesNoSessionCheck(req);
        if (!userData.redirect) {
          const prefix = userData.prefix;
          const apiData = await getDataFromApiWithoutVerify(prefix);
          let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
          
          if (typeof cookiesArray === 'string') {
            cookiesArray = JSON.parse(cookiesArray);
          }
          
          cookieString = cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        }
      }
    } catch (cookieError) {
      console.log('   ⚠️ Cookie error - continuing without auth');
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
      'Referer': 'https://iconscout.com/'
    };
    
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    const response = await axios.get(cdnUrl, {
      headers: headers,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   ✅ CDN3D Response:', response.status);
    
    if (response.status === 403 || response.status === 404) {
      console.log('   ⚠️ Blocked - returning transparent pixel');
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.status(200).send(transparentPixel);
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    console.log('   ✅ Sending image successfully');
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('   ❌ CDN3D error:', error.message);
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    return res.status(200).send(transparentPixel);
  }
});

// ✅ CDN Route
router.get(/^\/iconscout\/image\/cdn\/(.*)$/, async (req, res) => {
  try {
    const cdnPath = req.params[0];
    const cdnUrl = `https://cdn.iconscout.com/${cdnPath}`;
    
    console.log('🎨 [CDN] Request:', cdnUrl);
    
    let cookieString = '';
    
    try {
      if (req.cookies.auth_token && req.cookies.prefix) {
        const userData = await decryptUserCookiesNoSessionCheck(req);
        if (!userData.redirect) {
          const prefix = userData.prefix;
          const apiData = await getDataFromApiWithoutVerify(prefix);
          let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
          
          if (typeof cookiesArray === 'string') {
            cookiesArray = JSON.parse(cookiesArray);
          }
          
          cookieString = cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        }
      }
    } catch (cookieError) {
      console.log('   ⚠️ Cookie error - continuing without auth');
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
      'Referer': 'https://iconscout.com/'
    };
    
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    const response = await axios.get(cdnUrl, {
      headers: headers,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   ✅ CDN Response:', response.status);
    
    if (response.status === 403 || response.status === 404) {
      console.log('   ⚠️ Blocked - returning transparent pixel');
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.status(200).send(transparentPixel);
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    console.log('   ✅ Sending image successfully');
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('   ❌ CDN error:', error.message);
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    return res.status(200).send(transparentPixel);
  }
});

// ============================================
// ✅ STRAPI API PROXY (MUST BE BEFORE PRODUCT ROUTES!)
// ============================================
router.use('/strapi', async (req, res) => {
  try {
    console.log('📡 [STRAPI] Request:', req.originalUrl);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      console.log('   ❌ Unauthorized');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const targetUrl = `https://iconscout.com${req.originalUrl}`;
    console.log('   Target:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('   ✅ Strapi Response:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Strapi error:', error.message);
    return res.status(500).json({ error: 'API error' });
  }
});

// Auth routes
router.use('/', authRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Media proxy routes
router.use('/media', (req, res) => {
  return handleMediaProxy(req, res, flaticonConfig, 'media.flaticon.com');
});

// ✅ HANDLE ROOT-LEVEL API ROUTES (BEFORE AUTO-ROUTER!)
router.use((req, res, next) => {
  const productCookie = req.cookies.product || '';
  
  // Only handle these specific root paths (not if they're already prefixed)
  const rootApiPaths = ['/session/', '/json/', '/api/', '/a/', '/trackshop/', '/data-api/', '/elements-api/'];
  const startsWithRootApi = rootApiPaths.some(path => req.url === path.slice(0, -1) || req.url.startsWith(path));
  
  // Skip if URL already has product prefix
  if (req.url.startsWith('/epidemicsound/') || req.url.startsWith('/flaticon/') || 
      req.url.startsWith('/envato/') || req.url.startsWith('/vecteezy/')) {
    return next();
  }
  
 // Only prefix if this is a root API path
// Only prefix if this is a root API path
if (startsWithRootApi) {
  if (productCookie === 'epidemicsound') {
    console.log(`🔀 [ROOT API] ${req.originalUrl} → /epidemicsound${req.originalUrl}`);
    req.url = `/epidemicsound${req.originalUrl}`;
  } else if (productCookie === 'envato') {
    console.log(`🔀 [ROOT API] ${req.originalUrl} → /envato${req.originalUrl}`);
    req.url = `/envato${req.originalUrl}`;
  } else if (productCookie === 'freepik') {
    console.log(`🔀 [ROOT API] ${req.originalUrl} → /freepik${req.originalUrl}`);
    req.url = `/freepik${req.originalUrl}`;
  }
}
  
  return next();
});

// Add this BEFORE the auto-router, after /setup-session
router.get('/manifest.webmanifest', (req, res) => {
  const productCookie = req.cookies.product || '';
  
  if (productCookie === 'envato') {
    return res.json({
      name: "Envato Elements",
      short_name: "Elements",
      start_url: "/envato",
      display: "standalone",
      theme_color: "#82b541",
      background_color: "#ffffff",
      icons: []
    });
  }
  
  return res.json({
    name: "ToolsZilla",
    short_name: "ToolsZilla",
    start_url: "/",
    display: "standalone",
    icons: []
  });
});
 
// ============================================
// ✅ FIXED AUTO-ROUTER - NO MORE DOUBLE PREFIXING!
// ============================================
router.use((req, res, next) => {
  // ✅ CRITICAL FIX: Exit IMMEDIATELY if URL already has a product prefix
  const productPrefixes = [
    '/flaticon', '/envato', '/iconscout', '/stealthwriter',
    '/vecteezy', '/storyblocks', '/epidemicsound', '/turndetect',
    '/freepik', '/pikbest'
  ];
  
  // Check each prefix - if found, skip auto-routing completely
  for (const prefix of productPrefixes) {
    if (req.url.startsWith(prefix)) {
      // console.log(`✅ [AUTO-ROUTER] URL already has prefix ${prefix}, skipping`);
      return next();  // EXIT NOW - Don't modify the URL!
    }
  }

  // Skip system routes
  if (req.url.startsWith('/setup-session') || 
      req.url.startsWith('/health') ||
      req.url.startsWith('/manifest.json') ||
      req.url.startsWith('/cdn-cgi') ||
      req.url.startsWith('/admin') ||
      req.url.startsWith('/media') ||
      req.url.startsWith('/strapi') ||
      req.url.startsWith('/login') ||
      req.url.startsWith('/logout')) {
    return next();
  }

  const referer = req.headers.referer || '';
  const productCookie = req.cookies.product || '';
  const hasProductInReferer = productPrefixes.some(prefix => referer.includes(prefix));
  
 if (hasProductInReferer && productCookie !== 'freepik') {
  // Referer already has product context - don't add prefix (except for Freepik)
  return next();
}
  // Now add prefix based on cookie/referer (only if URL doesn't have it yet)
// Now add prefix based on cookie/referer (only if URL doesn't have it yet)
if (referer.includes('/epidemicsound') || productCookie === 'epidemicsound') {
  console.log(`🔀 [AUTO-ROUTER] ${req.url} → /epidemicsound${req.url}`);
  req.url = `/epidemicsound${req.url}`;
}
else if (referer.includes('/envato') || productCookie === 'envato') {
  console.log(`🔀 [AUTO-ROUTER] ${req.url} → /envato${req.url}`);
  req.url = `/envato${req.url}`;
}
else if (referer.includes('/freepik') || productCookie === 'freepik') {
  console.log(`🔀 [AUTO-ROUTER] ${req.url} → /freepik${req.url}`);
  req.url = `/freepik${req.url}`;
}
else if (referer.includes('/vecteezy') || productCookie === 'vecteezy') {
  console.log(`🔀 [AUTO-ROUTER] ${req.url} → /vecteezy${req.url}`);
  req.url = `/vecteezy${req.url}`;
}
  else if (referer.includes('/stealthwriter') || productCookie === 'stealthwriter') {
    console.log(`🔀 [AUTO-ROUTER] ${req.url} → /stealthwriter${req.url}`);
    req.url = `/stealthwriter${req.url}`;
  }
  else if (referer.includes('/turndetect') || productCookie === 'turndetect') {
    console.log(`🔀 [AUTO-ROUTER] ${req.url} → /turndetect${req.url}`);
    req.url = `/turndetect${req.url}`;
  }
  
  next();
});



// ============================================
// PRODUCT ROUTES (MUST BE LAST!)
// ============================================
router.use('/flaticon', flaticonRoutes);
console.log('✅ Registered /flaticon route');

router.use('/envato', envatoRoutes);
console.log('✅ Registered /envato route');

router.use('/vecteezy', vecteezyRoutes);
console.log('✅ Registered /vecteezy route');

router.use('/storyblocks', storyblocksRoutes);
console.log('✅ Registered /storyblocks route');

router.use('/epidemicsound', epidemicsoundRoutes);
console.log('✅ Registered /epidemicsound route');

router.use('/freepik', freepikRoutes);
console.log('✅ Registered /freepik route');

router.use('/iconscout', iconscoutRoutes);
console.log('✅ Registered /iconscout route');

router.use('/pikbest', pikbestRoutes);
console.log('✅ Registered /pikbest route');

router.use('/stealthwriter', stealthwriterRoutes);
console.log('✅ Registered /stealthwriter route');

router.use('/turndetect', turndetectRoutes);
console.log('✅ Registered /turndetect route');

export default router;