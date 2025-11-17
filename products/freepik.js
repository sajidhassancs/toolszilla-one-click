/**
 * Freepik Product Configuration
 */
export default {
  // Basic Info
  name: 'freepik',
  displayName: 'Freepik',

  // Target Website
  domain: 'www.freepik.com',

  // Redirect path after login
  redirectPath: '/',

  // Banned paths (product-specific, env vars will also apply)
  bannedPaths: [],  // ✅ Empty - we're using BANNED_URL_PATHS from .env

  // Proxy port (if running standalone)
  proxyPort: 8224,

  // Use external proxy server
  useExternalProxy: false,

  // Domain replacement rules [find, replace]
  replaceRules: [
    ['static.freepik.com', 'dev-server.primewp.net/freepik/static'],
    ['cdn.freepik.com', 'dev-server.primewp.net/freepik/cdn'],
    ['cdnb.freepik.com', 'dev-server.primewp.net/freepik/cdnb'],
    ['img.freepik.com', 'dev-server.primewp.net/freepik/img'],
    ['image.freepik.com', 'dev-server.primewp.net/freepik/image'],
    ['assets.freepik.com', 'dev-server.primewp.net/freepik/assets'],
    ['fps.cdnpk.net', 'dev-server.primewp.net/freepik/fps'],
    ['static.cdnpk.net', 'dev-server.primewp.net/freepik/static-cdnpk']
  ],

  // Custom headers for requests
  customHeaders: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'accept-encoding': 'gzip, deflate, br'
  },

  // Custom cookies (if any static cookies needed)
  customCookies: {}
};