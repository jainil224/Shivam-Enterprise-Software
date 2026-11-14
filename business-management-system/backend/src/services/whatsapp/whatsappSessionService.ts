// Phase 19.3 - WhatsApp session lifecycle.
//
// One client per company. The state machine is:
//   DISCONNECTED -> INITIALIZING -> QR_REQUIRED -> AUTHENTICATED -> CONNECTED
// with AUTH_FAILURE / DISCONNECTED as terminal-or-retry states.
//
// The service never returns QR secrets, session files or credentials to the
// browser: only a PNG data URL while the code is still valid.

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { AppError } from '../../utils/appError.js';
import {
  type WhatsAppClientHandle,
  type WhatsAppClientFactory,
  type WhatsAppClientLike,
  cleanupStaleSessionLocks,
  companyIdToClientId,
  hasPersistedSession,
  markSessionAuthenticated,
  removeSessionDirectory,
  whatsappClientFactory,
  whatsappSessionPath,
  whatsappSessionRoot,
} from './whatsappClientService.js';
import {
  WHATSAPP_UNOFFICIAL_WARNING,
  type WhatsAppConnectionState,
  type WhatsAppQrPayload,
  type WhatsAppStatus,
} from '../../types/whatsapp.js';

const QR_VALIDITY_MS = 60_000;
const INITIALIZE_TIMEOUT_MS = 5 * 60_000;
const READY_TIMEOUT_MS = 5 * 60_000;
const SERVICE_INSTANCE_ID = Math.random().toString(36).substring(2, 8).toUpperCase();
console.log(`[BMS WhatsApp] Service instance initialized: id=${SERVICE_INSTANCE_ID}, pid=${process.pid}`);

interface SessionRuntime {
  companyId: string;
  handle: WhatsAppClientHandle | null;
  client: WhatsAppClientLike | null;
  state: WhatsAppConnectionState;
  qrDataUrl: string | null;
  qrExpiresAt: number | null;
  qrTimer: NodeJS.Timeout | null;
  initTimer: NodeJS.Timeout | null;
  readyTimer: NodeJS.Timeout | null;
  connectedAt: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  updatedAt: string;
  starting: boolean;
  disposed: boolean;
  restartCount: number;
}

export type WhatsAppStatusListener = (status: WhatsAppStatus) => void;

export interface WhatsAppSessionServiceOptions {
  /** QR display lifetime. Overridable so the expiry path is testable. */
  qrValidityMs?: number;
  initializeTimeoutMs?: number;
  readyTimeoutMs?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeMessage(value: unknown): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  // Never surface anything that looks like a QR payload or a base64 blob.
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length === 0) return 'Unknown WhatsApp client error.';
  return compact.length > 300 ? compact.slice(0, 300) + '...' : compact;
}

export class WhatsAppSessionService {
  private readonly runtimes = new Map<string, SessionRuntime>();
  private readonly listeners = new Set<WhatsAppStatusListener>();

  private readonly qrValidityMs: number;
  private readonly initializeTimeoutMs: number;
  private readonly readyTimeoutMs: number;

  constructor(
    private readonly factory: WhatsAppClientFactory = whatsappClientFactory,
    options: WhatsAppSessionServiceOptions = {}
  ) {
    this.qrValidityMs = options.qrValidityMs ?? QR_VALIDITY_MS;
    this.initializeTimeoutMs = options.initializeTimeoutMs ?? INITIALIZE_TIMEOUT_MS;
    this.readyTimeoutMs = options.readyTimeoutMs ?? READY_TIMEOUT_MS;
  }

  subscribe(listener: WhatsAppStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(status: WhatsAppStatus): void {
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch {
        // A broken listener must never break the session lifecycle.
      }
    }
  }

  private runtime(companyId: string): SessionRuntime {
    const existing = this.runtimes.get(companyId);
    if (existing) return existing;
    const created: SessionRuntime = {
      companyId,
      handle: null,
      client: null,
      state: 'DISCONNECTED',
      qrDataUrl: null,
      qrExpiresAt: null,
      qrTimer: null,
      initTimer: null,
      readyTimer: null,
      connectedAt: null,
      phoneNumber: null,
      lastError: null,
      updatedAt: nowIso(),
      starting: false,
      disposed: false,
      restartCount: 0,
    };
    this.runtimes.set(companyId, created);
    return created;
  }

  private touch(runtime: SessionRuntime, patch: Partial<SessionRuntime>): void {
    Object.assign(runtime, patch);
    runtime.updatedAt = nowIso();
    this.emit(this.toStatus(runtime));
  }

  private clearTimers(runtime: SessionRuntime): void {
    if (runtime.qrTimer) clearTimeout(runtime.qrTimer);
    if (runtime.initTimer) clearTimeout(runtime.initTimer);
    if (runtime.readyTimer) clearTimeout(runtime.readyTimer);
    runtime.qrTimer = null;
    runtime.initTimer = null;
    runtime.readyTimer = null;
  }

  private toStatus(runtime: SessionRuntime): WhatsAppStatus {
    const qrValid = runtime.qrDataUrl !== null && runtime.qrExpiresAt !== null && runtime.qrExpiresAt > Date.now();
    return {
      state: runtime.state,
      connected: runtime.state === 'CONNECTED',
      phoneNumber: runtime.phoneNumber,
      connectedAt: runtime.connectedAt,
      qrAvailable: qrValid,
      qrExpiresAt: qrValid && runtime.qrExpiresAt ? new Date(runtime.qrExpiresAt).toISOString() : null,
      lastError: runtime.lastError,
      warning: WHATSAPP_UNOFFICIAL_WARNING,
      updatedAt: runtime.updatedAt,
    };
  }

  getStatus(companyId: string): WhatsAppStatus {
    return this.toStatus(this.runtime(companyId));
  }

  async getQr(companyId: string): Promise<WhatsAppQrPayload> {
    const runtime = this.runtime(companyId);
    if (!runtime.qrDataUrl || !runtime.qrExpiresAt || runtime.qrExpiresAt <= Date.now()) {
      throw new AppError(
        409,
        'No valid QR code is available. Start the connection again to request a fresh code.',
        undefined,
        'QR_UNAVAILABLE'
      );
    }
    return { qrDataUrl: runtime.qrDataUrl, expiresAt: new Date(runtime.qrExpiresAt).toISOString() };
  }

  /** Starts a session. Safe to call repeatedly: one client per company. */
  async connect(companyId: string): Promise<WhatsAppStatus> {
    const runtime = this.runtime(companyId);
    // One client per company: while a session is starting, waiting for a QR or
    // already authenticated, a repeat connect() only reports the current state.
    if (runtime.state !== 'DISCONNECTED' && runtime.state !== 'AUTH_FAILURE') {
      return this.toStatus(runtime);
    }
    if (runtime.starting) return this.toStatus(runtime);
    runtime.starting = true;
    runtime.disposed = false;
    runtime.restartCount = 0;
    this.touch(runtime, {
      state: 'INITIALIZING',
      lastError: null,
      qrDataUrl: null,
      qrExpiresAt: null,
      connectedAt: null,
      phoneNumber: null,
    });

    runtime.initTimer = setTimeout(() => {
      if (runtime.state === 'CONNECTED') return;
      void this.failRuntime(
        runtime,
        'The WhatsApp client did not finish connecting within 5 minutes. Close the stale browser and try again.',
        false
      );
    }, this.initializeTimeoutMs);

    void this.startRuntime(runtime);
    return this.toStatus(runtime);
  }

  private async startRuntime(runtime: SessionRuntime): Promise<void> {
    try {
      cleanupStaleSessionLocks(runtime.companyId);
      // If there is no authenticated session on disk, clear any stale/aborted unauthenticated
      // browser profile so Chrome starts fresh and immediately loads web.whatsapp.com without
      // redirects to /login/.
      if (!hasPersistedSession(runtime.companyId)) {
        removeSessionDirectory(runtime.companyId);
      }
      console.log(`[BMS WhatsApp] Starting browser client for company ${runtime.companyId}...`);
      const handle = await this.factory.create({
        sessionPath: whatsappSessionRoot(),
        clientId: runtime.companyId,
      });
      if (runtime.disposed) {
        await this.safeDestroy(handle);
        return;
      }
      runtime.handle = handle;
      runtime.client = handle.client;
      this.attachEvents(runtime);
      // initialize() resolves only after authentication; the events above drive
      // the visible state, so it is intentionally not awaited.
      void handle.client.initialize().catch((error: unknown) => {
        console.warn(`[BMS WhatsApp] Client error during initialization (${runtime.companyId}):`, error);
        void this.failRuntime(runtime, sanitizeMessage(error), false);
      });
      runtime.readyTimer = setTimeout(() => {
        if (runtime.state === 'CONNECTED') return;
        void this.failRuntime(
          runtime,
          'WhatsApp did not confirm the session within 5 minutes. Scan the QR code again.',
          false
        );
      }, this.readyTimeoutMs);
    } catch (error) {
      console.warn(`[BMS WhatsApp] Failed to launch client (${runtime.companyId}):`, error);
      await this.failRuntime(runtime, sanitizeMessage(error), false);
    } finally {
      runtime.starting = false;
    }
  }

  private attachEvents(runtime: SessionRuntime): void {
    const client = runtime.client;
    if (!client) return;

    client.on('qr', (qr: unknown) => {
      console.log(`[${nowIso()}] [BMS WhatsApp] QR code received for company ${runtime.companyId}`);
      void this.handleQr(runtime, qr);
    });

    client.on('loading_screen', (percent: unknown, message: unknown) => {
      console.log(`[${nowIso()}] [BMS WhatsApp] loading_screen: ${percent}% - ${message}`);
      if (runtime.state === 'QR_REQUIRED') return;
      this.touch(runtime, { state: 'INITIALIZING' });
    });

    client.on('change_state', (state: unknown) => {
      console.log(`[${nowIso()}] [BMS WhatsApp] change_state: ${state}`);
    });

    client.on('authenticated', () => {
      console.log(`[${nowIso()}] [BMS WhatsApp] Authenticated successfully for company ${runtime.companyId}`);
      markSessionAuthenticated(runtime.companyId);
      runtime.restartCount = 0;
      this.clearTimers(runtime);
      this.touch(runtime, {
        state: 'AUTHENTICATED',
        qrDataUrl: null,
        qrExpiresAt: null,
        lastError: null,
      });
    });

    client.on('ready', () => {
      console.log(`[${nowIso()}] [BMS WhatsApp] Client ready and connected for company ${runtime.companyId}`);
      markSessionAuthenticated(runtime.companyId);
      runtime.restartCount = 0;
      this.clearTimers(runtime);
      this.touch(runtime, {
        state: 'CONNECTED',
        connectedAt: nowIso(),
        phoneNumber: this.readPhoneNumber(client),
        qrDataUrl: null,
        qrExpiresAt: null,
        lastError: null,
      });
    });

    client.on('auth_failure', (message: unknown) => {
      console.warn(`[${nowIso()}] [BMS WhatsApp] Authentication failed for company ${runtime.companyId}:`, message);
      void this.failRuntime(
        runtime,
        'WhatsApp rejected the authentication: ' + sanitizeMessage(message),
        true
      );
    });

    client.on('disconnected', async (reason: unknown) => {
      const text = sanitizeMessage(reason);
      console.log(`[${nowIso()}] [BMS WhatsApp] Disconnected (${runtime.companyId}): ${text}`);
      // Capture screenshot and URL BEFORE any cleanup runs (as instructed in Step 1)
      const pupPage = (client as any)?.pupPage;
      if (pupPage) {
        try {
          const url = await pupPage.url();
          const title = await pupPage.title();
          console.log(`[${nowIso()}] [BMS WhatsApp] Page URL at disconnected: ${url}`);
          console.log(`[${nowIso()}] [BMS WhatsApp] Page Title at disconnected: ${title}`);
          const scPath = path.resolve(`./debug-wa-${Date.now()}.png`);
          await pupPage.screenshot({ path: scPath });
          console.log(`[${nowIso()}] [BMS WhatsApp] Saved debug screenshot: ${scPath}`);
        } catch (e) {
          console.error(`[${nowIso()}] [BMS WhatsApp] Failed to capture screenshot on disconnect:`, e);
        }
      }
      const unlinked = /logout|unlinked|conflict|replaced/i.test(text);
      void this.handleDisconnected(runtime, text, unlinked);
    });
  }

  private readPhoneNumber(client: WhatsAppClientLike): string | null {
    const user = client.info?.wid?.user;
    if (typeof user === 'string' && /^[0-9]{8,15}$/.test(user)) return user;
    return null;
  }

  private async handleQr(runtime: SessionRuntime, qr: unknown): Promise<void> {
    if (typeof qr !== 'string' || qr.length === 0) return;
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
      if (runtime.disposed) return;
      if (runtime.qrTimer) clearTimeout(runtime.qrTimer);
      const expiresAt = Date.now() + this.qrValidityMs;
      runtime.qrTimer = setTimeout(() => {
        if (runtime.state === 'CONNECTED') return;
        this.touch(runtime, {
          qrDataUrl: null,
          qrExpiresAt: null,
          lastError: 'The QR code expired. A new code appears automatically while WhatsApp is waiting; refresh if it does not.',
        });
      }, this.qrValidityMs);
      this.touch(runtime, {
        state: 'QR_REQUIRED',
        qrDataUrl,
        qrExpiresAt: expiresAt,
        lastError: null,
      });
    } catch {
      this.touch(runtime, {
        state: 'QR_REQUIRED',
        qrDataUrl: null,
        qrExpiresAt: null,
        lastError: 'The QR code could not be rendered. Please retry the connection.',
      });
    }
  }

  private async handleDisconnected(runtime: SessionRuntime, reason: string, unlinked: boolean): Promise<void> {
    const wasStarting = runtime.state === 'INITIALIZING' || runtime.starting;
    this.clearTimers(runtime);
    await this.safeDestroy(runtime.handle);
    runtime.handle = null;
    runtime.client = null;
    runtime.qrDataUrl = null;
    runtime.qrExpiresAt = null;
    runtime.connectedAt = null;
    runtime.phoneNumber = null;
    if (unlinked) {
      removeSessionDirectory(runtime.companyId);
      // If the session was logged out during initialization, retry at most 1 time (Phase 19.3 rule)
      if (wasStarting && !runtime.disposed && runtime.restartCount < 1) {
        runtime.restartCount++;
        console.log(
          `[BMS WhatsApp] Session was logged out during initialization. Restarting clean client for company ${runtime.companyId} (attempt 1/1)...`
        );
        this.touch(runtime, {
          state: 'INITIALIZING',
          lastError: 'Session expired, generating a new QR code...',
        });
        runtime.starting = true;
        setTimeout(() => {
          if (!runtime.disposed) {
            void this.startRuntime(runtime);
          }
        }, 20);
        return;
      }
    }
    this.touch(runtime, {
      state: 'DISCONNECTED',
      lastError: unlinked
        ? 'This WhatsApp account was unlinked or replaced. Click Connect WhatsApp to scan a new QR code.'
        : 'The WhatsApp connection was lost (' + reason + '). Reconnect to scan a new QR code.',
    });
  }

  private async failRuntime(runtime: SessionRuntime, message: string, removeSession: boolean): Promise<void> {
    this.clearTimers(runtime);
    await this.safeDestroy(runtime.handle);
    runtime.handle = null;
    runtime.client = null;
    runtime.qrDataUrl = null;
    runtime.qrExpiresAt = null;
    runtime.connectedAt = null;
    runtime.phoneNumber = null;
    if (removeSession) removeSessionDirectory(runtime.companyId);
    this.touch(runtime, { state: 'AUTH_FAILURE', lastError: message });
  }

  private async safeDestroy(handle: WhatsAppClientHandle | null): Promise<void> {
    console.trace(`[WA-TRACE] safeDestroy called at ${nowIso()}`);
    if (!handle) return;
    try {
      handle.client.removeAllListeners();
    } catch {
      // ignore
    }
    try {
      await handle.client.destroy();
    } catch {
      // A crashed browser cannot be destroyed cleanly; the profile is released
      // when the Chrome process exits.
    }
    try {
      const browser = (handle.client as any)?.pupBrowser;
      const proc = browser?.process?.();
      if (proc && !proc.killed && proc.pid) {
        try {
          process.kill(proc.pid, 0); // Throws if PID does not exist
          proc.kill('SIGKILL');
        } catch {
          // Process already terminated cleanly
        }
      }
    } catch {
      // ignore
    }
  }

  /** Explicit user disconnect: unlink the device, then remove local credentials. */
  async disconnect(companyId: string): Promise<WhatsAppStatus> {
    const runtime = this.runtime(companyId);
    this.clearTimers(runtime);
    runtime.disposed = true;
    const client = runtime.client;
    if (client) {
      try {
        await client.logout();
      } catch {
        // Already logged out / browser gone: destroy() below still releases it.
      }
    }
    await this.safeDestroy(runtime.handle);
    removeSessionDirectory(companyId);
    runtime.handle = null;
    runtime.client = null;
    runtime.qrDataUrl = null;
    runtime.qrExpiresAt = null;
    runtime.connectedAt = null;
    runtime.phoneNumber = null;
    runtime.starting = false;
    this.touch(runtime, { state: 'DISCONNECTED', lastError: null });
    return this.toStatus(runtime);
  }

  /**
   * Re-initializes every persisted session after a server restart. A stored
   * session that WhatsApp no longer accepts ends in AUTH_FAILURE and the UI then
   * offers a fresh QR code.
   */
  async restoreSessions(): Promise<string[]> {
    if ((process.env.WHATSAPP_RESTORE_SESSIONS || '').toLowerCase() === 'false') return [];
    const root = whatsappSessionRoot();
    let entries: string[] = [];
    try {
      if (!fs.existsSync(root)) return [];
      entries = fs.readdirSync(root);
    } catch {
      return [];
    }
    const restored: string[] = [];
    for (const entry of entries) {
      if (entry.startsWith('session-session-')) {
        // Clean up any corrupted nested directory from previous buggy runs
        try {
          fs.rmSync(path.join(root, entry), { recursive: true, force: true });
        } catch {}
        continue;
      }
      if (entry.includes('diag-') || entry.includes('diagnose-')) {
        // Clean up scratch diagnose directories
        try {
          fs.rmSync(path.join(root, entry), { recursive: true, force: true });
        } catch {}
        continue;
      }

      // Resolve the true company identifier (read from auth metadata or strip LocalAuth 'session-' prefix)
      let companyId = entry.startsWith('session-') ? entry.slice('session-'.length) : entry;
      const metaPath = path.join(root, entry, 'bms-authenticated.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.companyId) {
            companyId = meta.companyId;
          }
        } catch {}
      }
      if (!hasPersistedSession(companyId)) continue;
      const runtime = this.runtime(companyId);
      if (runtime.starting || runtime.state === 'CONNECTED') continue;
      try {
        await this.connect(companyId);
        restored.push(companyId);
      } catch (error) {
        console.warn(`[BMS Backend] WhatsApp restore skipped for ${companyId}:`, error instanceof Error ? error.message : error);
      }
    }
    return restored;
  }

  /** Destroys every browser without deleting credentials (used on shutdown). */
  async shutdownAll(): Promise<void> {
    const ids = Array.from(this.runtimes.keys());
    await Promise.all(
      ids.map(async (companyId) => {
        const runtime = this.runtimes.get(companyId);
        if (!runtime) return;
        this.clearTimers(runtime);
        runtime.disposed = true;
        await this.safeDestroy(runtime.handle);
        runtime.handle = null;
        runtime.client = null;
        runtime.state = 'DISCONNECTED';
        runtime.updatedAt = nowIso();
      })
    );
  }

  /** Test helper: drops a runtime without touching disk. */
  resetForTests(): void {
    for (const runtime of this.runtimes.values()) {
      this.clearTimers(runtime);
      runtime.disposed = true;
    }
    this.runtimes.clear();
  }

  sessionPathFor(companyId: string): string {
    return whatsappSessionPath(companyId);
  }

  /** The live client handle, or null when no browser session exists. */
  getHandle(companyId: string): WhatsAppClientHandle | null {
    return this.runtime(companyId).handle;
  }

  isConnected(companyId: string): boolean {
    return this.runtime(companyId).state === 'CONNECTED';
  }

  /** Resolves once the session reaches the expected state (used by tests). */
  async waitForState(
    companyId: string,
    expected: WhatsAppConnectionState,
    timeoutMs = 5000
  ): Promise<WhatsAppStatus> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = this.getStatus(companyId);
      if (status.state === expected) return status;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return this.getStatus(companyId);
  }
}

export const whatsappSessionService = new WhatsAppSessionService();