import * as Buffer from 'buffer';
(window as any).global = window;
(window as any).process = {};
(window as any).process = window;
(window as any).process.browser = true;
(window as any).process.version = '';
(window as any).process.versions = { node: false };
(window as any).process.nextTick = setTimeout;
(window as any).global.Buffer = Buffer.Buffer;

declare global {
  interface Window {
    Buffer: any;
  }
}

export default Buffer;
