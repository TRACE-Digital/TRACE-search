// https://stackoverflow.com/questions/46946380/fetch-api-request-timeout
import { isNode } from 'browser-or-node';

export default async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  options.signal = controller.signal;

  try {
    if (isNode) {
      // I hate node
      const fetch = require('node-fetch');
      return await fetch(url, options);
    } else {
      return await fetch(url, options);
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeout / 1000)} seconds`);
    }
    throw e;
  }
}
