import { PrismaClient } from '@prisma/client';
import { config } from '../../config/env.js';
import { GSTINVerificationResult, GSTINProviderStatus, GSTIN_REGEX, STATE_CODE_MAP } from './gstinTypes.js';
import { GSTINVerificationProvider } from './gstinProvider.interface.js';
import { NoProvider } from './providers/noProvider.js';
import { SandboxProvider } from './providers/sandboxProvider.js';
import { GSTINAPIProvider } from './providers/gstinApiProvider.js';

const prisma = new PrismaClient();

/** Cache entry stored in memory */
interface CacheEntry {
  result: GSTINVerificationResult;
  cachedAt: Date;
  creditsRemaining: number | null;
}

/** Cache TTL: 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class GSTINService {
  private provider: GSTINVerificationProvider;
  /** In-memory cache: GSTIN (uppercase) -> cache entry */
  private cache: Map<string, CacheEntry> = new Map();

  constructor() {
    // Provider choice comes from backend/.env (GSTIN_PROVIDER, or auto-detected
    // from GSTIN_API_KEY). Credentials never leave the server process.
    if (config.gstin.provider === 'sandbox') {
      this.provider = new SandboxProvider();
    } else if (config.gstin.provider === 'gstinapi') {
      this.provider = new GSTINAPIProvider();
    } else {
      this.provider = new NoProvider();
    }
  }

  /**
   * Set custom provider (useful for testing or switching at runtime)
   */
  setProvider(provider: GSTINVerificationProvider) {
    this.provider = provider;
  }

  /**
   * Get provider configuration status
   */
  getProviderStatus(): GSTINProviderStatus {
    return this.provider.getProviderStatus();
  }

  /**
   * Clear the entire in-memory cache (useful for tests)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Remove a single GSTIN from cache
   */
  evictCacheEntry(gstin: string) {
    this.cache.delete(gstin.trim().toUpperCase());
  }

  /**
   * Main verification flow:
   * 1. Validate format
   * 2. Check local Party Master in active company
   * 3. Check in-memory cache (unless forceRefresh)
   * 4. Query external provider
   * 5. Store result in cache
   * 6. Return verified result or clear error
   *
   * @param companyId  Active company ID (for local Party Master lookup)
   * @param rawGstin   GSTIN string entered by user
   * @param forceRefresh  When true, skip cache and force fresh API call
   */
  async verify(companyId: string, rawGstin: string, forceRefresh = false): Promise<GSTINVerificationResult> {
    const gstin = (rawGstin || '').trim().toUpperCase();

    // 1. Format validation
    if (!gstin) {
      const err: any = new Error('GSTIN is required.');
      err.statusCode = 400;
      err.code = 'INVALID_FORMAT';
      throw err;
    }

    if (gstin.length !== 15) {
      const err: any = new Error('GSTIN must be exactly 15 characters.');
      err.statusCode = 400;
      err.code = 'INVALID_FORMAT';
      throw err;
    }

    if (!GSTIN_REGEX.test(gstin)) {
      const err: any = new Error('Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5');
      err.statusCode = 400;
      err.code = 'INVALID_FORMAT';
      throw err;
    }

    const stateCode = gstin.substring(0, 2);
    const mappedState = STATE_CODE_MAP[stateCode] || 'Unknown';

    // 2. Priority 1: Check existing locally saved Party Master record in active company
    const localParty = await prisma.party.findFirst({
      where: {
        companyId,
        gstin,
      },
    });

    // A saved Party Master record is authoritative for a normal lookup (and
    // costs no credit). An explicit refresh must still reach the provider, so
    // the user can obtain genuinely fresh data; the link is preserved below.
    const linkedPartyId = localParty ? localParty.id : undefined;

    if (localParty && !forceRefresh) {
      return {
        gstin: localParty.gstin || gstin,
        legalName: localParty.partyName,
        tradeName: localParty.partyName,
        status: localParty.isActive ? 'ACTIVE' : 'INACTIVE',
        address: localParty.address || undefined,
        city: localParty.city || undefined,
        state: localParty.state || mappedState,
        stateCode,
        pincode: localParty.pincode || undefined,
        source: 'LOCAL_PARTY_MASTER',
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        providerName: 'Local Party Master',
        partyId: linkedPartyId,
      };
    }

    // 3. Check in-memory cache (skip if forceRefresh)
    if (!forceRefresh) {
      const cached = this.cache.get(gstin);
      if (cached) {
        const ageMs = Date.now() - cached.cachedAt.getTime();
        if (ageMs < CACHE_TTL_MS) {
          // Return cached result with CACHED source and cachedAt timestamp
          return {
            ...cached.result,
            source: 'CACHED',
            cachedAt: cached.cachedAt.toISOString(),
            creditsRemaining: cached.creditsRemaining,
          };
        } else {
          // Cache expired - remove it
          this.cache.delete(gstin);
        }
      }
    }

    // 4. Query external provider
    const externalResult = await this.provider.verifyGSTIN(gstin);

    if (!externalResult) {
      const err: any = new Error(`GSTIN '${gstin}' was not found on the external verification portal.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      err.portalUrl = 'https://services.gst.gov.in/services/searchtp';
      throw err;
    }

    // Verify exact GSTIN match (security check)
    if (externalResult.gstin.toUpperCase() !== gstin) {
      const err: any = new Error('GSTIN mismatch in provider response.');
      err.statusCode = 502;
      err.code = 'GSTIN_MISMATCH';
      throw err;
    }

    // 5. Extract credits_remaining from provider (only GSTINAPIProvider exposes this)
    const creditsRemaining: number | null =
      (this.provider as any).lastCreditsRemaining !== undefined
        ? (this.provider as any).lastCreditsRemaining
        : null;

    // Attach creditsRemaining to the fresh result
    const freshResult: GSTINVerificationResult = {
      ...externalResult,
      creditsRemaining,
      ...(linkedPartyId ? { partyId: linkedPartyId } : {}),
    };

    // 6. Store in cache
    this.cache.set(gstin, {
      result: freshResult,
      cachedAt: new Date(),
      creditsRemaining,
    });

    return freshResult;
  }

  /**
   * Save verified/entered supplier to Party Master (Optional user action)
   */
  async saveToPartyMaster(companyId: string, data: {
    gstin?: string;
    partyName: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
  }) {
    const cleanGstin = data.gstin ? data.gstin.trim().toUpperCase() : null;

    // Check duplicate by GSTIN within company if GSTIN is provided
    if (cleanGstin) {
      const existing = await prisma.party.findFirst({
        where: {
          companyId,
          gstin: cleanGstin,
        },
      });

      if (existing) {
        return {
          party: existing,
          isNew: false,
          message: `Supplier with GSTIN '${cleanGstin}' already exists in Party Master as '${existing.partyName}'.`,
        };
      }
    }

    // Generate unique partyCode: SUP-XXXX
    const count = await prisma.party.count({ where: { companyId } });
    const partyCode = `SUP-${String(count + 1).padStart(4, '0')}`;

    const newParty = await prisma.party.create({
      data: {
        companyId,
        partyCode,
        partyName: data.partyName.trim(),
        partyType: 'SUPPLIER',
        gstin: cleanGstin,
        panNumber: cleanGstin ? cleanGstin.substring(2, 12) : null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        pincode: data.pincode?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        isActive: true,
      },
    });

    return {
      party: newParty,
      isNew: true,
      message: `Supplier '${newParty.partyName}' saved to Party Master successfully.`,
    };
  }
}

export const gstinService = new GSTINService();
