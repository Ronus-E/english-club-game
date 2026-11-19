/**
 * Minimal Chrome DevTools Protocol client — no dependencies.
 * Node 24 provides a global WebSocket, so tests can drive a real browser
 * without Playwright or Puppeteer.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CHROME_CANDIDATES = [
  'chromium',
  '/usr/bin/chromium',
  'chromium-browser',
  'google-chrome',
  '/usr/bin/google-chrome',
];

export async function launchChromium({
  port = 9222,
  width = 1440,
  height = 900,
  userDataDir = '/tmp/opencode/chrome-english-club',
  extraArgs = [],
} = {}) {
  mkdirSync(userDataDir, { recursive: true });
  let lastError = null;
  for (const bin of CHROME_CANDIDATES) {
    try {
      const proc = spawn(bin, [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--force-device-scale-factor=1',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        `--window-size=${width},${height}`,
        'about:blank',
        ...extraArgs,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      const exited = new Promise((resolve) => proc.once('exit', resolve));
      const version = await waitForDevtools(port, 8000);
      if (version) return { proc, port, version, exited, bin };
      proc.kill('SIGKILL');
      await exited;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not start Chromium: ${lastError?.message || 'not found'}`);
}

async function waitForDevtools(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return await response.json();
    } catch { /* not ready yet */ }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return null;
}

export async function listTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  return response.json();
}

export async function newTarget(port, url = 'about:blank') {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return response.json();
}

export class Client {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.exceptions = [];
    this.closed = false;
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', () => reject(new Error(`WebSocket failed: ${this.wsUrl}`)), { once: true });
    });
    this.ws.addEventListener('message', (event) => this._onMessage(event.data));
    this.ws.addEventListener('close', () => { this.closed = true; });
    return this;
  }

  _onMessage(raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = (message.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      if (message.params.type === 'error') this.consoleErrors.push(text);
      else if (message.params.type === 'warning') this.consoleWarnings.push(text);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      this.exceptions.push(detail.exception?.description || detail.text || 'exception');
    }
    if (message.method === 'Log.entryAdded') {
      const entry = message.params.entry;
      if (entry.level === 'error') this.consoleErrors.push(`${entry.source}: ${entry.text}`);
      else if (entry.level === 'warning') this.consoleWarnings.push(`${entry.source}: ${entry.text}`);
    }
    const handlers = this.listeners.get(message.method);
    if (handlers) for (const handler of handlers) handler(message.params);
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('CDP socket closed'));
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const arr = this.listeners.get(method) || [];
        arr.splice(arr.indexOf(handler), 1);
        resolve(params);
      };
      this.on(method, handler);
    });
  }

  async init() {
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Log.enable');
    // Always test the current working tree, never a stale HTTP/SW cache.
    try {
      await this.send('Network.enable');
      await this.send('Network.setCacheDisabled', { cacheDisabled: true });
      await this.send('ServiceWorker.enable');
      await this.send('ServiceWorker.setForceUpdateOnPageLoad', { forceUpdateOnPageLoad: true });
    } catch { /* older builds */ }
    return this;
  }

  async goto(url, { waitForLoad = true, settleMs = 600 } = {}) {
    const loaded = waitForLoad ? this.once('Page.loadEventFired') : Promise.resolve();
    await this.send('Page.navigate', { url });
    if (waitForLoad) await Promise.race([loaded, new Promise((r) => setTimeout(r, 15000))]);
    if (settleMs) await new Promise((r) => setTimeout(r, settleMs));
    return this;
  }

  async evaluate(expression, { awaitPromise = true, timeout = 20000 } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
      timeout,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails;
      throw new Error(detail.exception?.description || detail.text || 'evaluate failed');
    }
    return result.result?.value;
  }

  async viewport(width, height, scale = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: scale, mobile: width < 720,
    });
    await new Promise((r) => setTimeout(r, 220));
  }

  async screenshot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  }

  async close() {
    try { await this.send('Page.close'); } catch { /* ignore */ }
    try { this.ws.close(); } catch { /* ignore */ }
  }

  resetLogs() {
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.exceptions = [];
  }
}
