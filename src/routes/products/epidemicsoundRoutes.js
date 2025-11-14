import express from 'express';
import axios from 'axios';
import epidemicsoundConfig from '../../../products/epidemicsound.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyEpidemicsoundWithAxios,
  proxyEpidemicsoundStatic,
  proxyEpidemicsoundCDN,
  proxyEpidemicsoundAssets,
  proxyEpidemicsoundImages,
  proxyEpidemicsoundMedia
} from './handlers/epidemicsoundHandlers.js';
import { decryptUserCookies } from '../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../services/apiService.js';
import { USER_AGENT } from '../../utils/constants.js';

const router = express.Router();

console.log('🎵 [EPIDEMIC SOUND] Router initialized - SIMPLIFIED');

// Root redirect
router.get('/', (req, res) => {
  return res.redirect('/epidemicsound/music/featured/?override_referrer=');
});

// Limit reached
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, epidemicsoundConfig.displayName, 'default');
});

// Static files routes
router.use('/static', proxyEpidemicsoundStatic);
router.use('/cdn', proxyEpidemicsoundCDN);
router.use('/assets', proxyEpidemicsoundAssets);
router.use('/images', proxyEpidemicsoundImages);
router.use('/media', proxyEpidemicsoundMedia);

// API routes
router.use('/api', async (req, res) => {
  try {
    const userData = await decryptUserCookies(req);
    const prefix = userData.prefix || req.cookies.prefix;
    
    if (!prefix) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    let apiPath = req.originalUrl.replace('/epidemicsound', '');
    const targetUrl = `https://www.epidemicsound.com${apiPath}`;
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://www.epidemicsound.com/',
        'Cookie': cookieString,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 15000
    });
    
    res.set('Access-Control-Allow-Origin', '*');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error('❌ API error:', error.message);
    return res.status(500).json({ error: 'API error' });
  }
});

// Session routes
router.use('/session', async (req, res) => {
  try {
    const userData = await decryptUserCookies(req);
    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    let sessionPath = req.originalUrl.replace('/epidemicsound', '');
    const targetUrl = `https://www.epidemicsound.com${sessionPath}`;
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://www.epidemicsound.com/',
        'Cookie': cookieString,
        'Content-Type': 'application/json'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 10000
    });
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', 'application/json');
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Session error:', error.message);
    return res.status(500).json({ error: 'Session error' });
  }
});

// Staticfiles
router.use('/staticfiles', async (req, res) => {
  try {
    const userData = await decryptUserCookies(req);
    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    let assetPath = req.originalUrl.replace('/epidemicsound', '');
    const targetUrl = `https://www.epidemicsound.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/',
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
    console.error('❌ Staticfiles error:', error.message);
    return res.status(500).send('');
  }
});

// Catch-all - use Axios proxy
router.use((req, res) => {
  return proxyEpidemicsoundWithAxios(req, res);
});

export default router;