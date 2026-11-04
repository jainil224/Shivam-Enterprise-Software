export interface GSTINVerificationResult {
  gstin: string;
  legalName: string;
  tradeName?: string;
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'INACTIVE';
  registrationDate?: string;
  cancellationDate?: string;
  taxpayerType?: string;
  blockStatus?: string;
  constitutionOfBusiness?: string;
  principalPlaceOfBusiness?: string;
  address?: string;
  state: string;
  stateCode: string;
  city?: string;
  pincode?: string;
  natureOfBusiness?: string;
  source: 'LOCAL_PARTY_MASTER' | 'EXTERNAL_API' | 'MANUAL_UNVERIFIED' | 'CACHED';
  isVerified: boolean;
  verifiedAt: string;
  providerName: string;
  partyId?: string;
  /** Credits remaining after this API call (only from EXTERNAL_API source) */
  creditsRemaining?: number | null;
  /** When this result was stored in cache (only present when source = 'CACHED') */
  cachedAt?: string;
}

export interface GSTINProviderStatus {
  provider: string;
  isConfigured: boolean;
  message: string;
  portalUrl: string;
  /** Last credits_remaining reported by the provider (null when unknown) */
  creditsRemaining?: number | null;
}

export const STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

