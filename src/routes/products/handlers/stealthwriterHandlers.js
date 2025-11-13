/**
 * StealthWriter Specific Handlers
 * Simple axios-based proxy (NO Puppeteer needed!)
 */
import axios from 'axios';
import { decryptUserCookies, decryptUserCookiesNoSessionCheck } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import stealthwriterConfig from '../../../../products/stealthwriter.js';

export async function getUserCookieString(req) {
  try {
    const userData = await decryptUserCookiesNoSessionCheck(req);
    
    if (userData.redirect) {
      return null;
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    if (!Array.isArray(cookiesArray)) {
      return null;
    }
    
    // ✅ DEBUG: Log the cookies we're using
    console.log('🍪 [DEBUG] Cookies for StealthWriter:');
    cookiesArray.forEach(cookie => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });
    
    return cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('❌ Cookie error:', error.message);
    return null;
  }
}

// Replace all instances of stealthwriter.ai with app.stealthwriter.ai

export async function proxyStealthWriterWithPuppeteer(req, res) {
  try {
    console.log('✍️ [STEALTHWRITER] Proxy request:', req.method, req.originalUrl);
    
    // Get cookies
    const cookieString = await getUserCookieString(req);
    if (!cookieString) {
      console.log('   ❌ No cookies - redirecting');
      return res.redirect('/setup-session');
    }

    console.log('   🍪 Sending cookies:', cookieString.substring(0, 150) + '...');

    // Clean path
    let cleanPath = req.originalUrl.replace('/stealthwriter', '');
    if (!cleanPath || cleanPath === '') {
      cleanPath = '/';
    }
    
    const targetUrl = `https://app.stealthwriter.ai${cleanPath}`;  // ✅ Changed
    console.log('   Target:', targetUrl);
    
    // Make request
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'referer': 'https://app.stealthwriter.ai/',  // ✅ Changed
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   Response:', response.status, response.headers['content-type']);
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const currentHost = `${req.protocol}://${req.get('host')}`;

    // Handle HTML
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      console.log('🔧 Rewriting HTML URLs...');
      
      // Replace domain URLs - ✅ Updated domain
      html = html.replace(/https:\/\/app\.stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      html = html.replace(/\/\/app\.stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      
      // Also handle main domain redirects
      html = html.replace(/https:\/\/stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      html = html.replace(/\/\/stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      
      // ✅ CRITICAL: Rewrite ALL anchor tags that go to root
      html = html.replace(/href="\//g, 'href="/stealthwriter/');
      html = html.replace(/href='\//g, "href='/stealthwriter/");
      
      // ✅ CRITICAL: Rewrite src attributes
      html = html.replace(/src="\//g, 'src="/stealthwriter/');
      html = html.replace(/src='\//g, "src='/stealthwriter/");
      
      // ✅ Rewrite srcset
      html = html.replace(/srcset="\//g, 'srcset="/stealthwriter/');
      html = html.replace(/srcset='\//g, "srcset='/stealthwriter/");
      
      // ✅ Fix action attributes (forms)
      html = html.replace(/action="\//g, 'action="/stealthwriter/');
      html = html.replace(/action='\//g, "action='/stealthwriter/");
      
      // ✅ Fix any double prefixes
      html = html.replace(/\/stealthwriter\/stealthwriter\//g, '/stealthwriter/');
      
      console.log('   ✅ HTML rewriting complete');
      
      res.set('Content-Type', 'text/html');
      return res.status(response.status).send(html);
    }
    
    // Handle JavaScript
    if (contentType.includes('javascript')) {
      let js = response.data.toString('utf-8');
      
      js = js.replace(/https:\/\/app\.stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      js = js.replace(/https:\/\/stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      js = js.replace(/["']\/(?!stealthwriter)/g, '"/stealthwriter/');
      
      res.set('Content-Type', contentType);
      return res.status(response.status).send(js);
    }
    
    // Handle CSS
    if (contentType.includes('css')) {
      let css = response.data.toString('utf-8');
      
      css = css.replace(/https:\/\/app\.stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      css = css.replace(/https:\/\/stealthwriter\.ai/g, `${currentHost}/stealthwriter`);
      css = css.replace(/url\(\/(?!stealthwriter)/g, 'url(/stealthwriter/');
      
      res.set('Content-Type', contentType);
      return res.status(response.status).send(css);
    }
    
    // Everything else (images, fonts, etc.)
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    return res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}