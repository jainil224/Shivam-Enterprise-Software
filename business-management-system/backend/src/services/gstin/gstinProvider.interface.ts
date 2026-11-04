import { GSTINVerificationResult, GSTINProviderStatus } from './gstinTypes.js';

export interface GSTINVerificationProvider {
  /**
   * Verify a GSTIN against the configured provider.
   * Returns null if taxpayer record is not found on the external provider.
   * Throws an error if provider is unconfigured, unreachable, or rejects the request.
   */
  verifyGSTIN(gstin: string): Promise<GSTINVerificationResult | null>;

  /**
   * Get the current status and configuration health of the provider.
   */
  getProviderStatus(): GSTINProviderStatus;
}

