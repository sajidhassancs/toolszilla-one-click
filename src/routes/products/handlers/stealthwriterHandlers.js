/**
 * StealthWriter Handlers with Queue System
 * Base tag + No caching + Queue for /api/humanize
 */
import axios from 'axios';
import { decryptUserCookiesNoSessionCheck } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import {
  addQueueJob,
  getJobByEmail,
  getQueueStatus
} from '../../../services/stealthWriterQueue.js';

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

    return cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('❌ Cookie error:', error.message);
    return null;
  }
}

/**
 * Handle /api/humanize and /api/humanize/alternatives with queue
 */
export async function handleHumanizeRequest(req, res) {
  try {
    console.log('✍️ [HUMANIZE] Request received');

    // Get user data
    const userData = await decryptUserCookiesNoSessionCheck(req);
    if (userData.redirect) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = userData.user_email || 'unknown@email.com';
    const requestData = req.body;

    console.log(`   User: ${userEmail}`);
    console.log(`   Request type: ${req.originalUrl.includes('alternatives') ? 'alternatives' : 'humanize'}`);

    // Add request type to data so processor knows which endpoint to use
    requestData._endpoint = req.originalUrl.includes('alternatives') ? 'alternatives' : 'humanize';

    // Add to queue
    const added = await addQueueJob(userEmail, requestData);

    if (!added) {
      const queueStatus = await getQueueStatus();
      return res.status(429).json({
        error: 'You already have a job in the queue. Please wait.',
        queue: queueStatus
      });
    }

    console.log(`✅ Added to queue for ${userEmail}`);

    // Poll for completion
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();

    const pollInterval = setInterval(async () => {
      try {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(pollInterval);
          return res.status(504).json({
            error: 'Request timed out. Please try again later.'
          });
        }

        // Check job status
        const job = await getJobByEmail(userEmail);

        if (job && job.status === 'completed') {
          clearInterval(pollInterval);

          const result = job.result || {};

          if (result.success) {
            // Return the exact response from StealthWriter
            res.set('Content-Type', 'text/x-component');
            return res.status(200).send(result.response);
          } else {
            return res.status(500).json({
              error: result.error || 'Unknown error'
            });
          }
        }

        if (job && job.status === 'failed') {
          clearInterval(pollInterval);
          return res.status(500).json({
            error: job.result?.error || 'Processing failed'
          });
        }

      } catch (pollError) {
        console.error('❌ Poll error:', pollError.message);
      }
    }, 2000); // Check every 2 seconds

  } catch (error) {
    console.error('❌ Humanize error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Regular proxy handler for non-API routes
 */
export async function proxyStealthWriterWithPuppeteer(req, res) {
  try {
    console.log('✍️ [STEALTHWRITER] Proxy request:', req.method, req.originalUrl);

    // Get cookies
    const cookieString = await getUserCookieString(req);
    if (!cookieString) {
      console.log('   ❌ No cookies - redirecting');
      return res.redirect('/setup-session');
    }

    // Clean path
    let cleanPath = req.originalUrl.replace('/stealthwriter', '');
    if (!cleanPath || cleanPath === '') {
      cleanPath = '/dashboard';
    }

    const targetUrl = `https://app.stealthwriter.ai${cleanPath}`;
    console.log('   Target:', targetUrl);

    // Make request
    const headers = {
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'referer': 'https://app.stealthwriter.ai/',
      'user-agent': USER_AGENT,
      'Cookie': cookieString
    };

    // ✅ CRITICAL: Detect if this is an RSC request (Next.js navigation)
    const isRSCRequest = cleanPath.includes('?_rsc=');

    if (cleanPath.includes('/_next/') || cleanPath.includes('.js')) {
      headers['accept'] = '*/*';
    } else if (cleanPath.includes('/api/')) {
      headers['accept'] = 'application/json, text/plain, */*';
    } else if (isRSCRequest) {
      headers['accept'] = 'text/x-component';  // ✅ RSC-specific header
    } else {
      headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    }

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });

    console.log('   Response:', response.status, response.headers['content-type']);

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // Set cache-control headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Handle HTML
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');

      console.log('🔧 Processing HTML...');

      // ✅ CRITICAL: Only add base tag for FULL page loads, not RSC requests
      if (!isRSCRequest) {
        const baseTag = '<base href="/stealthwriter/">';

        const scriptBlock = `<script>
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));}
(function(){const f=window.fetch;window.fetch=function(...a){let u=a[0];if(typeof u==='string'&&(u.startsWith('/_next/')||u.startsWith('/api/'))){console.log('🔧',u);a[0]='/stealthwriter'+u;}return f.apply(this,a);};})();
</script>`;

        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${scriptBlock}${baseTag}`);
          console.log('   ✅ Script + base tag injected at HEAD start');
        } else if (html.includes('<!DOCTYPE html>')) {
          html = html.replace('<!DOCTYPE html>', `<!DOCTYPE html>${scriptBlock}`);
          console.log('   ✅ Script injected after DOCTYPE');
        } else {
          html = scriptBlock + html;
          console.log('   ✅ Script injected at document start');
        }
      } else {
        console.log('   ⚠️ Skipping base tag (RSC request)');
      }

      // Block tracking scripts
      html = html.replace(/<script[^>]+trackdesk\.com[^>]*><\/script>/gi, '<!-- Tracking blocked -->');
      html = html.replace(/<script[^>]+googletagmanager\.com[^>]*><\/script>/gi, '<!-- GTM blocked -->');
      html = html.replace(/<script[^>]+google-analytics\.com[^>]*><\/script>/gi, '<!-- GA blocked -->');
      html = html.replace(/onerror=["'][^"']*["']/gi, '');

      console.log('   ✅ HTML processed');

      // ✅ SUPER AGGRESSIVE CACHE BUSTING
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '-1');
      res.set('Surrogate-Control', 'no-store');

      res.set('Content-Type', 'text/html');
      return res.status(response.status).send(html);
    }

    // Everything else
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}