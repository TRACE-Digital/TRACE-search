import * as Buffer from 'buffer';
(window as any).global = window;
(window as any).global.Buffer = Buffer.Buffer;

declare global {
  interface Window { Buffer: any; }
}

export default Buffer;
