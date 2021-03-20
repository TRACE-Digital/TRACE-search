// https://stackoverflow.com/questions/46946380/fetch-api-request-timeout
import { isNode } from 'browser-or-node';

export default function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  options.signal = controller.signal;

  if (isNode) {
    // I hate node
    const fetch = require('node-fetch');
    return fetch(url, options);
  } else {
    return fetch(url, options);
  }
}
