// Phase 19.3 - WhatsApp Web client factory.
//
// The real implementation wraps the unofficial `whatsapp-web.js` library.
// Every method is isolated behind the small structural interfaces below so the
// test suite can inject a mock client without launching a browser and without
// ever messaging a real number.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Minimal event surface used by the session service. */
export interface WhatsAppClientEvents {
  on(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(): void;
}

export interface WhatsAppClientLike extends WhatsAppClientEvents {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  logout(): Promise<void>;
  sendMessage(chatId: string, content: unknown, options?: Record<string, unknown>): Promise<unknown>;
  getState(): Promise<string>;
  info?: { wid?: { user?: string; _serialized?: string } } | undefined;
}

export interface WhatsAppMedia {
  mimetype: string;
  data: string;
  filename: string;
}

export interface WhatsAppClientHandle {
  client: WhatsAppClientLike;
  createMedia(buffer: Buffer, fileName: string, mimeType: string): WhatsAppMedia;
}

export interface WhatsAppClientCreateConfig {
  /** Absolute directory that holds the LocalAuth session for this company. */
  sessionPath: string;
  /** Stable client id so LocalAuth reuses the same session folder. */
  clientId: string;
}

export interface WhatsAppClientFactory {
  create(config: WhatsAppClientCreateConfig): Promise<WhatsAppClientHandle>;
}

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

/**
 * Resolves the browser executable used by Puppeteer.
 * Checks CHROME_PATH and WHATSAPP_CHROME_PATH, then standard Chrome & Edge locations.
 */
export function resolveBrowserExecutable(): string | null {
  const configured = (process.env.CHROME_PATH || process.env.WHATSAPP_CHROME_PATH || '').trim();
  if (configured.length > 0) {
    return fs.existsSync(configured) ? configured : null;
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Creates the session directory outside every static/public folder and tightens
 * its permissions. Session files must never be reachable from the frontend.
 */
export function ensureSessionDirectory(sessionPath: string): void {
  fs.mkdirSync(sessionPath, { recursive: true });
  try {
    fs.chmodSync(sessionPath, 0o700);
  } catch {
    // Windows ignores POSIX modes; the directory is still outside the web root.
  }
}

class WhatsAppWebJsFactory implements WhatsAppClientFactory {
  async create(config: WhatsAppClientCreateConfig): Promise<WhatsAppClientHandle> {
    const executablePath = resolveBrowserExecutable();
    if (!executablePath) {
      throw new Error(
        'No Chrome or Edge executable was found. Install Google Chrome or set WHATSAPP_CHROME_PATH in backend/.env.'
      );
    }

    ensureSessionDirectory(config.sessionPath);

    // Dynamic import keeps the heavy dependency out of every other code path.
    // whatsapp-web.js is CommonJS, so the constructors can arrive either as
    // namespace members or under `default` depending on the Node ESM interop.
    const imported = (await import('whatsapp-web.js')) as unknown as Record<string, unknown>;
    const whatsapp = ((imported.default ?? imported) as unknown) as {
      Client: new (options: Record<string, unknown>) => WhatsAppClientLike;
      LocalAuth: new (options: Record<string, unknown>) => unknown;
      MessageMedia: new (mimetype: string, data: string, filename?: string) => unknown;
    };
    if (typeof whatsapp.LocalAuth !== 'function' || typeof whatsapp.Client !== 'function') {
      throw new Error(
        'whatsapp-web.js did not expose its Client/LocalAuth constructors. Reinstall the dependency.'
      );
    }

    // Phase 4 fix applied via patch-package (patches/whatsapp-web.js+1.34.8.patch):
    // All three waitForFunction calls in Client.js now include polling: 200.
    // This prevents the headless Chrome requestAnimationFrame throttling timeout
    // on Windows that caused "TimeoutError: Waiting failed: 90000ms exceeded".

    const headlessEnv = (process.env.WA_HEADLESS || 'true').trim().toLowerCase();
    const headlessOption: boolean | 'shell' = headlessEnv === 'false' ? false : true;

    const customUserAgent = (process.env.WA_USER_AGENT || '').trim();

    const authStrategy = new whatsapp.LocalAuth({
      dataPath: config.sessionPath,
      clientId: companyIdToClientId(config.clientId),
    });

    // Minimal config ported directly from test-wa.js (no webVersionCache, no extra args, no userAgent)
    const client = new whatsapp.Client({
      authStrategy,
      puppeteer: {
        headless: headlessOption,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    return {
      client,
      createMedia(buffer: Buffer, fileName: string, mimeType: string): WhatsAppMedia {
        const media = new whatsapp.MessageMedia(mimeType, buffer.toString('base64'), fileName);
        return media as WhatsAppMedia;
      },
    };
  }
}

export const whatsappClientFactory: WhatsAppClientFactory = new WhatsAppWebJsFactory();

/** Converts a company UUID to a stable, clean client identifier for WhatsApp Web. */
export function companyIdToClientId(companyId: string): string {
  const safe = companyId.replace(/[^a-zA-Z0-9-]/g, '');
  const hash = crypto.createHash('md5').update(safe).digest('hex').substring(0, 16);
  return `co_${hash}`;
}

/** Root directory for every WhatsApp session. Never inside `public` or `dist`. */
export function whatsappSessionRoot(): string {
  const configured = (process.env.WHATSAPP_SESSION_DIR || '').trim();
  if (configured.length > 0) return path.resolve(configured);
  return path.resolve(process.cwd(), '.whatsapp-sessions');
}

/** Session directory for one company. */
export function whatsappSessionPath(companyId: string): string {
  const safe = companyId.replace(/[^a-zA-Z0-9-]/g, '');
  const clientId = companyIdToClientId(companyId);
  return path.join(whatsappSessionRoot(), `session-${clientId}`);
}

/** True when LocalAuth already stored credentials for this company. */
export function hasPersistedSession(companyId: string): boolean {
  const safe = companyId.replace(/[^a-zA-Z0-9-]/g, '');
  const clientId = companyIdToClientId(companyId);
  const candidates = [
    path.join(whatsappSessionRoot(), `session-${clientId}`),
    path.join(whatsappSessionRoot(), clientId),
    path.join(whatsappSessionRoot(), `session-${safe}`),
    path.join(whatsappSessionRoot(), safe),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) continue;
      // Only considered a persisted session if the session was successfully authenticated
      if (entries.includes('bms-authenticated.json')) return true;
      if (entries.includes('session-restore.json')) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/** Marks a company session as authenticated after successful QR pairing / ready event. */
export function markSessionAuthenticated(companyId: string): void {
  const safe = companyId.replace(/[^a-zA-Z0-9-]/g, '');
  const clientId = companyIdToClientId(companyId);
  const candidates = [
    path.join(whatsappSessionRoot(), `session-${clientId}`),
    path.join(whatsappSessionRoot(), clientId),
    path.join(whatsappSessionRoot(), `session-${safe}`),
    path.join(whatsappSessionRoot(), safe),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      try {
        fs.writeFileSync(
          path.join(dir, 'bms-authenticated.json'),
          JSON.stringify({ authenticatedAt: new Date().toISOString(), companyId: safe, clientId }),
          'utf8'
        );
      } catch {
        // non-fatal
      }
    }
  }
}

/** Removes stale Chrome lock files that prevent restarts after a timeout or crash. */
export function cleanupStaleSessionLocks(companyId: string): void {
  const safe = companyId.replace(/[^a-zA-Z0-9-]/g, '');
  const clientId = companyIdToClientId(companyId);
  const candidates = [
    path.join(whatsappSessionRoot(), `session-${clientId}`),
    path.join(whatsappSessionRoot(), clientId),
    path.join(whatsappSessionRoot(), `session-${safe}`),
    path.join(whatsappSessionRoot(), safe),
  ];
  const lockNames = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const name of lockNames) {
      try {
        const lockPath = path.join(dir, name);
        if (fs.existsSync(lockPath)) {
          fs.rmSync(lockPath, { force: true });
        }
      } catch {
        // non-fatal
      }
    }
  }
}

/** Removes a company session directory after an explicit disconnect or failed auth. */
export function removeSessionDirectory(companyId: string): void {
  console.trace(`[WA-TRACE] removeSessionDirectory called for company ${companyId} at ${new Date().toISOString()}`);
  const safe = companyId.replace(/[^a-zA-Z0-9-]/g, '');
  const clientId = companyIdToClientId(companyId);
  const targets = [
    path.join(whatsappSessionRoot(), `session-${clientId}`),
    path.join(whatsappSessionRoot(), clientId),
    path.join(whatsappSessionRoot(), `session-${safe}`),
    path.join(whatsappSessionRoot(), safe),
  ];
  for (const target of targets) {
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    } catch {
      // A locked Chrome profile is retried on the next disconnect; the auth
      // strategy is already invalidated by logout(), so no credential leaks.
    }
  }
}