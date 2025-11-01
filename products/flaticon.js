/**
 * Flaticon Product Configuration
 */
export default {
  // Basic Info
  name: 'flaticon',
  displayName: 'Flaticon',
  
  // Target Website
  domain: 'www.flaticon.com',
  
  // Redirect path after login
  redirectPath: '/',  // ← CHANGED: Just go to homepage
  
  // Banned paths (users cannot access these)
  bannedPaths: ['admin', 'config', 'settings'],
  
  // Proxy port (if running standalone)
  proxyPort: 8224,
  
  // Use external proxy server
  useExternalProxy: false,
  
  // Domain replacement rules [find, replace]
  replaceRules: [
    ['media.flaticon.com', '{HOST}/media']
  ],
  
  // Custom headers for requests
  customHeaders: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'accept-encoding': 'gzip'
  },
  
  // Custom cookies (if any static cookies needed)
  customCookies: {}
};