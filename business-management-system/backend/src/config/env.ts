import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend root. This is the ONLY place provider
// credentials are read from - they are never sent to the React app.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rawGstinKey = (process.env.GSTIN_API_KEY || '').trim();
const requestedProvider = (process.env.GSTIN_PROVIDER || '').trim().toLowerCase();

/** gstinapi = live provider / sandbox = offline fixtures / none = disabled */
const SUPPORTED_GSTIN_PROVIDERS = ['gstinapi', 'sandbox', 'none'] as const;
type GstinProviderName = (typeof SUPPORTED_GSTIN_PROVIDERS)[number];

const isSupportedProvider = (value: string): value is GstinProviderName =>
  (SUPPORTED_GSTIN_PROVIDERS as readonly string[]).includes(value);

// Default to the live provider whenever a key is present, so a correctly filled
// .env works with no extra configuration. No key means disabled - never a fake result.
const resolvedGstinProvider: GstinProviderName = requestedProvider
  ? isSupportedProvider(requestedProvider)
    ? requestedProvider
    : 'none'
  : rawGstinKey
    ? 'gstinapi'
    : 'none';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  isProduction: process.env.NODE_ENV === 'production',
  gstin: {
    provider: resolvedGstinProvider,
    apiKey: rawGstinKey,
    baseUrl: (process.env.GSTIN_API_BASE_URL || 'https://www.gstinapi.in').trim().replace(/\/+$/, ''),
    isConfigured:
      resolvedGstinProvider === 'sandbox' ||
      (resolvedGstinProvider === 'gstinapi' && rawGstinKey.length > 0),
  },
};