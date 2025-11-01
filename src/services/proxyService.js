/**
 * Proxy Service
 * Handles proxying requests to target websites
 */
import axios from 'axios';
import { shouldDecodeAsText } from '../utils/helpers.js';
import { cookiesToString } from '../utils/helpers.js';

/**
 * Make a proxy request to target URL
 */
export async function makeProxyRequest(url, method, cookies, headers, proxy = null, data = null) {
  try {
    const config = {
      method,
      url,
      headers: {
        ...headers,
        'Cookie': cookiesToString(cookies)
      },
      responseType: 'arraybuffer',
      validateStatus: () => true, // Don't throw on any status
      maxRedirects: 0 // Handle redirects manually
    };

    // Add proxy if provided
    if (proxy) {
      const [host, port] = proxy.split(':');
      config.proxy = {
        host,
        port: parseInt(port, 10)
      };
    }

    // Add body data for POST/PUT/PATCH
    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = data;
    }

    const response = await axios(config);

    return {
      status: response.status,
      headers: response.headers,
      data: Buffer.from(response.data)
    };
  } catch (error) {
    // Handle redirect errors (302, 301)
    if (error.response && (error.response.status === 302 || error.response.status === 301)) {
      return {
        status: error.response.status,
        headers: error.response.headers,
        data: null,
        redirectLocation: error.response.headers['location']
      };
    }

    console.error('❌ Proxy request error:', error.message);
    throw error;
  }
}

/**
 * Replace domains in content
 */
export function replaceDomains(content, targetDomain, proxyHost, replaceRules = []) {
  let modifiedContent = content;

  // Replace target domain with proxy host
  const domainRegex = new RegExp(targetDomain, 'g');
  modifiedContent = modifiedContent.replace(domainRegex, proxyHost);

  // Apply custom replace rules
  for (const [find, replace] of replaceRules) {
    const regex = new RegExp(find, 'g');
    modifiedContent = modifiedContent.replace(regex, replace);
  }

  return modifiedContent;
}

/**
 * Process proxy response (apply replacements if text)
 */
export function processProxyResponse(responseData, lowerPath, contentType, targetDomain, proxyHost, replaceRules = []) {
  // Check if content should be processed as text
  if (shouldDecodeAsText(lowerPath, contentType)) {
    let textContent = responseData.toString('utf-8');
    
    // Apply replacements
    textContent = replaceDomains(textContent, targetDomain, proxyHost, replaceRules);
    
    return Buffer.from(textContent, 'utf-8');
  }

  // Return binary content as-is
  return responseData;
}