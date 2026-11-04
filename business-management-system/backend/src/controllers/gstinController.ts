import { Request, Response } from 'express';
import { gstinService } from '../services/gstin/gstinService.js';

export const verifyGSTIN = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    if (!companyId) {
      res.status(400).json({ error: { message: 'x-company-id header is required.' } });
      return;
    }

    const gstin = (req.params.gstin || req.query.gstin || req.body?.gstin || '') as string;
    const forceRefresh =
      req.query.refresh === 'true' ||
      req.query.forceRefresh === 'true' ||
      req.body?.forceRefresh === true;

    const result = await gstinService.verify(companyId, gstin, forceRefresh);

    res.status(200).json({ data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: {
        message: err.message || 'GSTIN verification failed.',
        // Stable machine-readable code so the UI can render the right guidance
        // for invalid format / not found / bad key / no credits / rate limit / outage.
        code: err.code,
        portalUrl: err.portalUrl,
      },
    });
  }
};

export const getGSTINProviderStatus = async (_req: Request, res: Response) => {
  try {
    const status = gstinService.getProviderStatus();
    res.status(200).json({ data: status });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Failed to get provider status.' } });
  }
};

export const saveSupplierToPartyMaster = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    if (!companyId) {
      res.status(400).json({ error: { message: 'x-company-id header is required.' } });
      return;
    }

    const { partyName, gstin, address, city, state, pincode, phone, email } = req.body;
    if (!partyName || !partyName.trim()) {
      res.status(400).json({ error: { message: 'Party Name is required.' } });
      return;
    }

    const result = await gstinService.saveToPartyMaster(companyId, {
      partyName,
      gstin,
      address,
      city,
      state,
      pincode,
      phone,
      email,
    });

    res.status(result.isNew ? 201 : 200).json({ data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to save party.' } });
  }
};

