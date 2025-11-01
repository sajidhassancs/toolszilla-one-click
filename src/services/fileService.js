/**
 * File Service
 * Handles file downloads and caching
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { getCache, setCache } from './cacheService.js';
import { getMimeType, shouldDecodeAsText } from '../utils/helpers.js';
import { TEXT_EXTS } from '../utils/constants.js';
import { cookiesToString, parseCookieString } from '../utils/helpers.js';
import { replaceDomains } from './proxyService.js';

/**
 * Download and cache a file
 */
export async function downloadFile(url, cookies, headers, targetDomain, proxyHost, replaceRules = []) {
  const urlObj = new URL(url);
  const urlPath = urlObj.pathname || '/';

  // Check memory cache
  const cached = getCache('staticFiles', url);
  if (cached) {
    if (cached.isText) {
      let content = cached.body;
      content = replaceDomains(content, targetDomain, proxyHost, replaceRules);
      return { content, contentType: cached.mime };
    } else {
      return { content: cached.body, contentType: cached.mime };
    }
  }

  // Create local file path
  const staticDir = path.join(process.cwd(), 'storage', 'cache', 'flaticon'); // TODO: Make dynamic per product
  const localPath = path.join(staticDir, urlPath);
  const dir = path.dirname(localPath);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  // Check if file exists on disk
  try {
    const stats = await fs.stat(localPath);
    if (stats.isFile()) {
      const ext = path.extname(localPath).toLowerCase();
      const isText = TEXT_EXTS.includes(ext);

      if (isText) {
        const content = await fs.readFile(localPath, 'utf-8');
        setCache('staticFiles', url, {
          isText: true,
          mime: getMimeType(localPath),
          body: content
        });

        let result = replaceDomains(content, targetDomain, proxyHost, replaceRules);
        return { content: result, contentType: getMimeType(localPath) };
      } else {
        const content = await fs.readFile(localPath);
        setCache('staticFiles', url, {
          isText: false,
          mime: getMimeType(localPath),
          body: content
        });
        return { content, contentType: getMimeType(localPath) };
      }
    }
  } catch {
    // File doesn't exist, fetch it
  }

  // Fetch from upstream
  try {
    const response = await axios.get(url, {
      headers: {
        ...headers,
        'Cookie': cookiesToString(cookies)
      },
      responseType: 'arraybuffer'
    });

    const data = Buffer.from(response.data);
    const ext = path.extname(localPath).toLowerCase();
    const isText = TEXT_EXTS.includes(ext);

    if (isText) {
      const content = data.toString('utf-8');
      await fs.writeFile(localPath, content, 'utf-8');

      setCache('staticFiles', url, {
        isText: true,
        mime: response.headers['content-type'] || getMimeType(localPath),
        body: content
      });

      let result = replaceDomains(content, targetDomain, proxyHost, replaceRules);
      return { content: result, contentType: response.headers['content-type'] || getMimeType(localPath) };
    } else {
      await fs.writeFile(localPath, data);

      setCache('staticFiles', url, {
        isText: false,
        mime: response.headers['content-type'] || getMimeType(localPath),
        body: data
      });

      return { content: data, contentType: response.headers['content-type'] || getMimeType(localPath) };
    }
  } catch (error) {
    console.error('❌ Error downloading file:', error.message);
    throw error;
  }
}