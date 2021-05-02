import { isNode } from 'browser-or-node';

export const sha256 = async (message: string) => {
  if (isNode) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(message).digest('hex');
    return hash;
  }
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};
