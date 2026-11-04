import { GSTINVerificationProvider } from '../gstinProvider.interface.js';
import { GSTINVerificationResult, GSTINProviderStatus, STATE_CODE_MAP } from '../gstinTypes.js';

/** Free test GSTIN published by gstinapi.in - the number used for sandbox runs. */
export const SANDBOX_TEST_GSTIN = '00AAAAA0000A1ZT';

export class SandboxProvider implements GSTINVerificationProvider {
  private readonly portalUrl = 'https://services.gst.gov.in/services/searchtp';

  async verifyGSTIN(gstin: string): Promise<GSTINVerificationResult | null> {
    const cleanGstin = gstin.trim().toUpperCase();
    const stateCode = cleanGstin.substring(0, 2);
    const stateName = STATE_CODE_MAP[stateCode] || 'Gujarat';

    // Documented test GSTIN: deterministic fixture so integration runs are repeatable.
    if (cleanGstin === SANDBOX_TEST_GSTIN) {
      return {
        gstin: cleanGstin,
        legalName: 'SANDBOX TEST TAXPAYER PRIVATE LIMITED',
        tradeName: 'SANDBOX TEST TRADER',
        status: 'ACTIVE',
        registrationDate: '2017-07-01',
        taxpayerType: 'Regular',
        constitutionOfBusiness: 'Private Limited Company',
        blockStatus: 'Unblocked',
        principalPlaceOfBusiness: 'Sandbox Address, Chennai, Tamil Nadu - 600015',
        address: 'Sandbox Address, Chennai, Tamil Nadu - 600015',
        state: STATE_CODE_MAP['33'] ?? 'Tamil Nadu',
        stateCode: '33',
        city: 'Chennai',
        pincode: '600015',
        natureOfBusiness: 'Sandbox fixture - not a real taxpayer',
        source: 'EXTERNAL_API',
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        providerName: 'Sandbox GST Verification Provider',
      };
    }

    // In sandbox, treat specific known test GSTIN or test pattern
    if (cleanGstin === '24AAAAA0000A1Z5' || cleanGstin.endsWith('1Z5')) {
      return {
        gstin: cleanGstin,
        legalName: 'RELIANCE INDUSTRIES LIMITED (YARN DIVISION)',
        tradeName: 'RELIANCE TEXTILES',
        status: 'ACTIVE',
        registrationDate: '2017-07-01',
        taxpayerType: 'Regular',
        constitutionOfBusiness: 'Public Limited Company',
        principalPlaceOfBusiness: 'Plot 101, GIDC Sachin, Surat, Gujarat - 394230',
        address: 'Plot 101, GIDC Sachin, Surat, Gujarat - 394230',
        state: stateName,
        stateCode,
        city: 'Surat',
        pincode: '394230',
        natureOfBusiness: 'Manufacturing of Synthetic Yarn and Texturised Filament',
        source: 'EXTERNAL_API',
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        providerName: 'Sandbox GST Verification Provider',
      };
    }

    if (cleanGstin === '24CANCL0001A1Z9') {
      return {
        gstin: cleanGstin,
        legalName: 'CANCELLED YARN ENTERPRISES',
        status: 'CANCELLED',
        state: stateName,
        stateCode,
        source: 'EXTERNAL_API',
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        providerName: 'Sandbox GST Verification Provider',
      };
    }

    if (cleanGstin === '24NOTFD0001A1Z8') {
      return null;
    }

    // Default valid mock response for testing when GSTIN_PROVIDER=sandbox
    return {
      gstin: cleanGstin,
      legalName: `TEST SUPPLIER (${cleanGstin.substring(2, 12)})`,
      tradeName: `TEST SUPPLIER TRADE`,
      status: 'ACTIVE',
      registrationDate: '2018-04-01',
      taxpayerType: 'Regular',
      constitutionOfBusiness: 'Proprietorship',
      address: `Industrial Area, ${stateName} - 395002`,
      state: stateName,
      stateCode,
      city: stateName === 'Gujarat' ? 'Surat' : 'City',
      pincode: '395002',
      natureOfBusiness: 'Wholesale & Manufacturing',
      source: 'EXTERNAL_API',
      isVerified: true,
      verifiedAt: new Date().toISOString(),
      providerName: 'Sandbox GST Verification Provider',
    };
  }

  getProviderStatus(): GSTINProviderStatus {
    return {
      provider: 'sandbox',
      isConfigured: true,
      message: 'Sandbox GST verification provider active (for automated testing only).',
      portalUrl: this.portalUrl,
    };
  }
}

