import { config } from '../../../config/env.js';
import { GSTINVerificationProvider } from '../gstinProvider.interface.js';
import { GSTINVerificationResult, GSTINProviderStatus, STATE_CODE_MAP } from '../gstinTypes.js';

/**
 * GSTINAPIProvider - live provider for https://www.gstinapi.in (API v1).
 *
 *   Endpoint : GET {baseUrl}/v1/gstin/{gstin}
 *   Auth     : x-api-key header, value read from backend/.env -> GSTIN_API_KEY
 *   Cost     : 1 credit per successful lookup. Malformed GSTIN, not-found and
 *              provider outages are free, so validation happens locally first.
 *
 * Documented success payload (HTTP 200):
 * {
 *   "success": true,
 *   "gstin": "22AAAAA0000A1Z5",
 *   "credits_remaining": 487,
 *   "response_ms": 312,
 *   "data": {
 *     "gstin": "22AAAAA0000A1Z5",
 *     "legal_name": "EXAMPLE PRIVATE LIMITED",
 *     "trade_name": "EXAMPLE PVT LTD",
 *     "status": "Active",
 *     "taxpayer_type": "Regular",
 *     "business_constitution": null,
 *     "registration_date": "2017-07-01",
 *     "cancellation_date": null,
 *     "state_code": "22",
 *     "address": "SHOP NO. 12, 1ST FLOOR, 123 BUSINESS PARK, RAIPUR",
 *     "city": "RAIPUR",
 *     "address_details": { "building_number": "...", "pincode": "492001", ... },
 *     "pincode": "492001",
 *     "nature_of_business": null,
 *     "block_status": "Unblocked"
 *   }
 * }
 *
 * Documented failure payload (every non-2xx): { "success": false, "error": "..." }
 *
 * Documented status codes:
 *   200 success (1 credit) | 400 invalid format (free) | 401 missing/invalid key
 *   402 out of credits | 403 account deactivated | 404 GSTIN not registered (free)
 *   429 rate limit | 502 GST provider temporarily unavailable
 */

/** Free test GSTIN published in the provider documentation. Never charged. */
export const DOCUMENTED_TEST_GSTIN = '00AAAAA0000A1ZT';

/** Only these two are safe to retry per the provider documentation. */
const RETRYABLE_CODES = new Set(['RATE_LIMIT', 'PROVIDER_UNAVAILABLE']);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 200;

interface ProviderError extends Error {
  statusCode?: number;
  code?: string;
  portalUrl?: string;
}

const providerError = (
  message: string,
  statusCode: number,
  code: string,
  portalUrl?: string
): ProviderError => {
  const err = new Error(message) as ProviderError;
  err.statusCode = statusCode;
  err.code = code;
  if (portalUrl) err.portalUrl = portalUrl;
  return err;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns the first non-empty trimmed string, or undefined. */
const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

export class GSTINAPIProvider implements GSTINVerificationProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly portalUrl = 'https://services.gst.gov.in/services/searchtp';

  /** Most recent credits_remaining reported by the provider. */
  public lastCreditsRemaining: number | null = null;

  /**
   * @param options Test-only overrides. Production callers pass nothing and the
   *                values come from backend/.env (never from the browser).
   */
  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = (options.apiKey ?? config.gstin.apiKey ?? '').trim();
    this.baseUrl = (options.baseUrl ?? config.gstin.baseUrl ?? 'https://www.gstinapi.in')
      .trim()
      .replace(/\/+$/, '');
  }

  getProviderStatus(): GSTINProviderStatus {
    if (!this.apiKey) {
      return {
        provider: 'gstinapi',
        isConfigured: false,
        message: 'GSTIN API key is missing. Set GSTIN_API_KEY in backend/.env to enable live GSTIN verification.',
        portalUrl: this.portalUrl,
        creditsRemaining: this.lastCreditsRemaining,
      };
    }
    return {
      provider: 'gstinapi',
      isConfigured: true,
      message: `Live verification active via GSTINAPI (${this.baseUrl}).`,
      portalUrl: this.portalUrl,
      creditsRemaining: this.lastCreditsRemaining,
    };
  }

  async verifyGSTIN(gstin: string): Promise<GSTINVerificationResult | null> {
    const cleanGstin = gstin.trim().toUpperCase();

    if (!this.apiKey) {
      throw providerError(
        'GSTIN provider is not configured. Set GSTIN_API_KEY in backend/.env.',
        503,
        'NOT_CONFIGURED',
        this.portalUrl
      );
    }

    let attempt = 1;
    // Retry only 429 / 502, at most MAX_ATTEMPTS total. 4xx failures are final.
    for (;;) {
      try {
        return await this.fetchOnce(cleanGstin);
      } catch (thrown) {
        const err = thrown as ProviderError;
        const retryable = err.code !== undefined && RETRYABLE_CODES.has(err.code);
        if (!retryable || attempt >= MAX_ATTEMPTS) throw err;
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
        attempt += 1;
      }
    }
  }

  /** One HTTP round trip. Returns null when the provider says the GSTIN is unknown. */
  private async fetchOnce(cleanGstin: string): Promise<GSTINVerificationResult | null> {
    const url = `${this.baseUrl}/v1/gstin/${encodeURIComponent(cleanGstin)}`;

    let rawResponse: Response;
    try {
      rawResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          Accept: 'application/json',
        },
      });
    } catch (networkErr) {
      const message = networkErr instanceof Error ? networkErr.message : 'Connection failed.';
      throw providerError(
        `GSTIN provider could not be reached: ${message}`,
        502,
        'PROVIDER_UNAVAILABLE',
        this.portalUrl
      );
    }

    // Error payloads are documented as { success: false, error: "..." }, but a
    // gateway outage can still return HTML - never let parsing mask the status.
    let body: any = null;
    try {
      body = await rawResponse.json();
    } catch {
      body = null;
    }

    if (typeof body?.credits_remaining === 'number') {
      this.lastCreditsRemaining = body.credits_remaining;
    }

    if (!rawResponse.ok) {
      const detail = firstText(body?.error, body?.message, body?.detail, rawResponse.statusText);
      const status = rawResponse.status;

      switch (status) {
        case 400:
          throw providerError(
            `Invalid GSTIN: ${detail ?? 'the provider rejected the format.'}`,
            400,
            'INVALID_FORMAT'
          );
        case 401:
          throw providerError(
            'GSTIN API key is missing or invalid. Check GSTIN_API_KEY in backend/.env.',
            401,
            'INVALID_API_KEY'
          );
        case 402:
          throw providerError(
            'GSTIN API credits exhausted. Recharge the GSTINAPI account to continue live verification.',
            402,
            'INSUFFICIENT_CREDITS',
            this.portalUrl
          );
        case 403:
          throw providerError(
            'GSTIN API account is deactivated. Contact the provider or use a different API key.',
            403,
            'ACCOUNT_DEACTIVATED'
          );
        case 404:
          // Not registered in the GST database - free, and not an outage.
          return null;
        case 429:
          throw providerError(
            'GSTIN provider rate limit exceeded (60 requests/minute). Please wait a moment and retry.',
            429,
            'RATE_LIMIT'
          );
        default:
          if (status >= 500) {
            throw providerError(
              `GSTIN provider is temporarily unavailable (HTTP ${status}). Please retry shortly.`,
              502,
              'PROVIDER_UNAVAILABLE',
              this.portalUrl
            );
          }
          throw providerError(
            `GSTIN provider error (HTTP ${status}): ${detail ?? 'unknown error'}`,
            502,
            'PROVIDER_ERROR',
            this.portalUrl
          );
      }
    }

    if (!body || typeof body !== 'object') {
      throw providerError(
        'GSTIN provider returned a non-JSON response.',
        502,
        'PROVIDER_ERROR',
        this.portalUrl
      );
    }

    // success:false with HTTP 200 - treat a "not found" wording as 404, anything
    // else as a hard failure. Never fabricate a result here.
    if (body.success === false) {
      const detail = firstText(body.error, body.message);
      const lowered = (detail ?? '').toLowerCase();
      if (lowered.includes('not found') || lowered.includes('not registered') || lowered.includes('does not exist')) {
        return null;
      }
      throw providerError(
        detail ?? 'GSTIN lookup failed.',
        400,
        'LOOKUP_FAILED'
      );
    }

    const data: any = body.data ?? {};
    const returnedGstin = firstText(body.gstin, data.gstin)?.toUpperCase();

    if (!returnedGstin) {
      throw providerError(
        'GSTIN provider returned a response with no GSTIN field.',
        502,
        'PROVIDER_ERROR',
        this.portalUrl
      );
    }

    // Requirement: a result only counts when the returned GSTIN matches exactly.
    if (returnedGstin !== cleanGstin) {
      throw providerError(
        `GSTIN mismatch: requested '${cleanGstin}', provider returned '${returnedGstin}'.`,
        502,
        'GSTIN_MISMATCH',
        this.portalUrl
      );
    }

    const legalName = firstText(data.legal_name, data.legalName, body.legal_name);
    if (!legalName) {
      // Never substitute the GSTIN or a placeholder for a missing taxpayer name.
      throw providerError(
        'GSTIN provider returned no legal name for this registration.',
        502,
        'PROVIDER_ERROR',
        this.portalUrl
      );
    }

    const stateCode = firstText(data.state_code, body.state_code) ?? cleanGstin.substring(0, 2);
    const stateName = STATE_CODE_MAP[stateCode] ?? stateCode;

    // Structured address: prefer the documented address_details object, fall
    // back to the single-line address string. Null parts are simply skipped.
    const details = data.address_details;
    let structuredAddress: string | undefined;
    let detailCity: string | undefined;
    let detailPincode: string | undefined;
    if (details && typeof details === 'object') {
      const parts: string[] = [];
      for (const key of [
        'building_number',
        'building_name',
        'floor',
        'street',
        'locality',
        'district',
        'state',
        'pincode',
      ]) {
        const value = firstText(details[key]);
        if (value) parts.push(value);
      }
      structuredAddress = parts.length > 0 ? parts.join(', ') : undefined;
      detailCity = firstText(details.city, details.locality);
      detailPincode = firstText(details.pincode);
    }

    const address = firstText(data.address, data.principal_business_address, body.address) ?? structuredAddress;
    const city = firstText(data.city, body.city) ?? detailCity;
    const pincode = firstText(data.pincode, body.pincode) ?? detailPincode;

    const rawStatus = (firstText(data.status, data.registration_status, body.status) ?? '')
      .toUpperCase()
      .replace(/\s+/g, ' ');

    let status: GSTINVerificationResult['status'] = 'ACTIVE';
    if (rawStatus.includes('CANCEL')) status = 'CANCELLED';
    else if (rawStatus.includes('SUSPEND')) status = 'SUSPENDED';
    else if (rawStatus.includes('INACTIVE') || rawStatus.includes('MIGRAT')) status = 'INACTIVE';
    else if (rawStatus.includes('ACTIVE')) status = 'ACTIVE';

    const taxpayerType = firstText(data.taxpayer_type, body.taxpayer_type);
    const constitution = firstText(data.business_constitution, data.constitution_of_business, body.business_constitution);
    const natureOfBusiness = firstText(data.nature_of_business, body.nature_of_business);
    const registrationDate = firstText(data.registration_date, data.date_of_registration, body.registration_date);
    const cancellationDate = firstText(data.cancellation_date, body.cancellation_date);
    const blockStatus = firstText(data.block_status, body.block_status);

    return {
      gstin: returnedGstin,
      legalName,
      tradeName: firstText(data.trade_name, body.trade_name),
      status,
      registrationDate,
      cancellationDate,
      taxpayerType,
      blockStatus,
      constitutionOfBusiness: constitution,
      principalPlaceOfBusiness: address,
      address,
      state: stateName,
      stateCode,
      city,
      pincode,
      natureOfBusiness,
      source: 'EXTERNAL_API',
      isVerified: true,
      verifiedAt: new Date().toISOString(),
      providerName: 'GSTINAPI (gstinapi.in)',
      creditsRemaining: this.lastCreditsRemaining,
    };
  }
}