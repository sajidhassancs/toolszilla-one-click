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
      validateStatus: () => true,
      maxRedirects: 0
    };

    if (proxy) {
      const [host, port] = proxy.split(':');
      config.proxy = {
        host,
        port: parseInt(port, 10)
      };
    }

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
 * Replace domains in content - FIXED VERSION
 */
export function replaceDomains(content, targetDomain, proxyHost, replaceRules = []) {
  let modifiedContent = content;

  // Escape special regex characters in domain
  const escapedDomain = targetDomain.replace(/\./g, '\\.');
  
  // Replace target domain (preserve protocol)
  modifiedContent = modifiedContent.replace(
    new RegExp(`https://${escapedDomain}`, 'g'), 
    proxyHost.startsWith('http') ? proxyHost : `http://${proxyHost}`
  );
  modifiedContent = modifiedContent.replace(
    new RegExp(`http://${escapedDomain}`, 'g'), 
    proxyHost.startsWith('http') ? proxyHost : `http://${proxyHost}`
  );
  
  // Replace protocol-relative URLs (//domain.com)
  modifiedContent = modifiedContent.replace(
    new RegExp(`//${escapedDomain}`, 'g'), 
    `//${proxyHost.replace(/^https?:\/\//, '')}`
  );

  // Apply custom replace rules
  for (const [find, replace] of replaceRules) {
    const escapedFind = find.replace(/\./g, '\\.');
    const replaceWith = replace.replace('{HOST}', proxyHost.startsWith('http') ? proxyHost : `http://${proxyHost}`);
    
    // Replace with protocol
    modifiedContent = modifiedContent.replace(
      new RegExp(`https://${escapedFind}`, 'g'), 
      replaceWith.startsWith('http') ? replaceWith : `http://${replaceWith}`
    );
    modifiedContent = modifiedContent.replace(
      new RegExp(`http://${escapedFind}`, 'g'), 
      replaceWith.startsWith('http') ? replaceWith : `http://${replaceWith}`
    );
    
    // Replace protocol-relative URLs
    modifiedContent = modifiedContent.replace(
      new RegExp(`//${escapedFind}`, 'g'), 
      `//${replaceWith.replace(/^https?:\/\//, '')}`
    );
  }

  return modifiedContent;
}

/**
 * Process proxy response (apply replacements if text)
 */
export function processProxyResponse(responseData, lowerPath, contentType, targetDomain, proxyHost, replaceRules = []) {
  if (shouldDecodeAsText(lowerPath, contentType)) {
    let textContent = responseData.toString('utf-8');
    textContent = replaceDomains(textContent, targetDomain, proxyHost, replaceRules);
    return Buffer.from(textContent, 'utf-8');
  }

  return responseData;
}