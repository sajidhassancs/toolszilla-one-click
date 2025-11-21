/**
 * Envato Axios Handlers - OPTIMIZED (No Puppeteer)
 */
import axios from 'axios';
import { decryptUserCookies, decryptUserCookiesNoSessionCheck } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import envatoConfig from '../../../../products/envato.js';

function getCurrentRotationIndex(totalAccounts) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    const intervalIndex = Math.floor(totalMinutes / 10);
    return intervalIndex % totalAccounts;
}

/**
 * ✅ OPTIMIZED: Main Envato proxy handler (Axios-based)
 */
export async function proxyEnvatoWithAxios(req, res) {
    try {
        console.log('🎨 [AXIOS] Envato request:', req.method, req.originalUrl);

        const userData = await decryptUserCookies(req);

        if (userData.redirect) {
            return res.redirect(userData.redirect);
        }

        const prefix = userData.prefix;
        const apiData = await getDataFromApiWithoutVerify(prefix);
        const accountsArray = apiData.access_configuration_preferences[0].accounts;

        if (!accountsArray || accountsArray.length === 0) {
            return res.status(500).json({ error: 'No accounts available' });
        }

        const currentIndex = getCurrentRotationIndex(accountsArray.length);
        let cookiesArray = accountsArray[currentIndex];

        if (typeof cookiesArray === 'string') {
            cookiesArray = JSON.parse(cookiesArray);
        }

        const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

        let cleanPath = req.originalUrl.replace('/envato', '');

        if (!cleanPath || cleanPath === '/' || cleanPath === '') {
            cleanPath = '/';
        }

        const targetUrl = `https://elements.envato.com${cleanPath}`;

        console.log('🎯 Target URL:', targetUrl);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            headers: {
                ...envatoConfig.customHeaders,
                'referer': 'https://elements.envato.com/',
                'user-agent': USER_AGENT,
                'Cookie': cookieString
            },
            data: req.body,
            validateStatus: () => true,
            responseType: 'arraybuffer',
            maxRedirects: 5,
            timeout: 15000
        });

        console.log(`✅ Response: ${response.status}`);

        const contentType = response.headers['content-type'] || 'application/octet-stream';

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', contentType);

        // ✅ SIMPLIFIED: Minimal HTML processing
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf-8');

            const currentHost = `${req.protocol}://${req.get('host')}`;

            // Just rewrite external domains
            html = html.replace(/https:\/\/assets\.elements\.envato\.com/g, `${currentHost}/envato/assets`);
            html = html.replace(/https:\/\/elements-resized\.envatousercontent\.com/g, `${currentHost}/envato/images`);
            html = html.replace(/https:\/\/envato-shoebox\.imgix\.net/g, `${currentHost}/envato/images`);
            html = html.replace(/https:\/\/account\.envato\.com/g, `${currentHost}/envato/account`);

            return res.status(response.status).send(html);
        }

        return res.status(response.status).send(response.data);

    } catch (error) {
        console.error('❌ Error:', error.message);
        return res.status(500).json({ error: 'Proxy error' });
    }
}

/**
 * ✅ OPTIMIZED: Envato assets (no session check)
 */
export async function proxyEnvatoAssetsOptimized(req, res) {
    try {
        const assetPath = req.path.replace('/assets', '');
        const targetUrl = `https://assets.elements.envato.com${assetPath}`;

        console.log('🎨 [ASSET] Proxying:', targetUrl);

        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': req.headers.accept || '*/*',
                'Referer': 'https://elements.envato.com/'
            },
            validateStatus: () => true,
            timeout: 10000
        });

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=31536000');

        if (response.headers['content-type']) {
            res.set('Content-Type', response.headers['content-type']);
        }

        return res.status(response.status).send(response.data);
    } catch (error) {
        console.error('❌ Asset error:', error.message);
        return res.status(500).send('');
    }
}

/**
 * ✅ OPTIMIZED: Envato images (no session check)
 */
export async function proxyEnvatoImagesOptimized(req, res) {
    try {
        const userData = await decryptUserCookiesNoSessionCheck(req);

        if (userData.redirect) {
            return res.redirect(userData.redirect);
        }

        const prefix = userData.prefix;
        const apiData = await getDataFromApiWithoutVerify(prefix);
        const accountsArray = apiData.access_configuration_preferences[0].accounts;

        const currentIndex = getCurrentRotationIndex(accountsArray.length);
        let cookiesArray = accountsArray[currentIndex];

        if (typeof cookiesArray === 'string') {
            cookiesArray = JSON.parse(cookiesArray);
        }

        const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

        let imagePath = req.originalUrl.replace('/envato/images', '');
        if (!imagePath || imagePath === '/') {
            imagePath = req.path.replace('/images', '');
        }

        let targetDomain;
        if (imagePath.includes('envato-shoebox') || imagePath.includes('envato-dam')) {
            targetDomain = 'envato-shoebox.imgix.net';
        } else {
            targetDomain = 'elements-resized.envatousercontent.com';
        }

        const targetUrl = `https://${targetDomain}${imagePath}`;

        console.log('🖼️  [IMAGE] Proxying:', targetUrl);

        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://elements.envato.com/',
                'Accept': 'image/*',
                'Cookie': cookieString
            },
            validateStatus: () => true,
            timeout: 10000
        });

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=31536000');

        if (response.headers['content-type']) {
            res.set('Content-Type', response.headers['content-type']);
        }

        return res.status(response.status).send(response.data);
    } catch (error) {
        console.error('❌ Image error:', error.message);
        return res.status(500).send('');
    }
}