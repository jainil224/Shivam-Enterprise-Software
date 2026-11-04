import { GSTINVerificationProvider } from '../gstinProvider.interface.js';
import { GSTINVerificationResult, GSTINProviderStatus } from '../gstinTypes.js';

export class NoProvider implements GSTINVerificationProvider {
  private readonly portalUrl = 'https://services.gst.gov.in/services/searchtp';

  async verifyGSTIN(_gstin: string): Promise<GSTINVerificationResult | null> {
    const err: any = new Error(
      'External GSTIN verification is not configured. Configure an authorized GST verification provider to enable automatic lookup.'
    );
    err.statusCode = 503;
    err.portalUrl = this.portalUrl;
    throw err;
  }

  getProviderStatus(): GSTINProviderStatus {
    return {
      provider: 'none',
      isConfigured: false,
      message:
        'External GSTIN verification is not configured. Configure an authorized GST verification provider to enable automatic lookup.',
      portalUrl: this.portalUrl,
    };
  }
}

