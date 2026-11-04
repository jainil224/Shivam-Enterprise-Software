import { Request, Response } from 'express';
import { purchaseBillService } from '../services/purchaseBillService.js';

export const createPurchaseBill = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;

    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const bill = await purchaseBillService.createBill(companyId, financialYearId, req.body);
    res.status(201).json({
      data: bill,
      message: `Purchase Bill #${bill?.billNumber} created successfully.`,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: {
        message: err.message || 'Failed to create purchase bill.',
        existingBill: err.existingBill,
      },
    });
  }
};

export const getPurchaseBillById = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    if (!companyId) {
      res.status(400).json({ error: { message: 'x-company-id header is required.' } });
      return;
    }

    const bill = await purchaseBillService.getBillById(companyId, req.params.id);
    res.status(200).json({ data: bill });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to fetch purchase bill.' } });
  }
};

export const getPurchaseBillByChallanId = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    if (!companyId) {
      res.status(400).json({ error: { message: 'x-company-id header is required.' } });
      return;
    }

    const bill = await purchaseBillService.getBillByChallanId(companyId, req.params.challanId);
    res.status(200).json({ data: bill });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Failed to query purchase bill by challan.' } });
  }
};

export const listPurchaseBills = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;

    if (!companyId) {
      res.status(400).json({ error: { message: 'x-company-id header is required.' } });
      return;
    }

    const result = await purchaseBillService.listBills(companyId, {
      financialYearId: req.query.financialYearId?.toString() || financialYearId,
      search: req.query.search?.toString(),
      page: req.query.page ? parseInt(req.query.page.toString(), 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit.toString(), 10) : 20,
    });

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Failed to list purchase bills.' } });
  }
};

