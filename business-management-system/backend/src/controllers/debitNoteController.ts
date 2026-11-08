import { Request, Response } from 'express';
import { debitNoteService } from '../services/debitNoteService.js';

export const listDebitNotes = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const {
      page,
      limit,
      search,
      bookId,
      partyId,
      noteType,
      reason,
      status,
      startDate,
      endDate,
    } = req.query;

    const result = await debitNoteService.listPaginated(companyId, financialYearId, {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      search: search as string,
      bookId: bookId as string,
      partyId: partyId as string,
      noteType: noteType as any,
      reason: reason as any,
      status: status as any,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.status(200).json(result);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to list Debit Notes.' } });
  }
};

export const getDebitNoteById = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { id } = req.params;
    const note = await debitNoteService.getById(companyId, financialYearId, id);
    res.status(200).json({ data: note });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get Debit Note.' } });
  }
};

export const createDebitNote = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const note = await debitNoteService.create(companyId, financialYearId, req.body);
    res.status(201).json({ data: note });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to create Debit Note.' } });
  }
};

export const updateDebitNote = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { id } = req.params;
    const note = await debitNoteService.update(companyId, financialYearId, id, req.body);
    res.status(200).json({ data: note });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to update Debit Note.' } });
  }
};

export const cancelDebitNote = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { id } = req.params;
    const { cancellationReason } = req.body;
    const note = await debitNoteService.cancel(companyId, financialYearId, id, cancellationReason);
    res.status(200).json({ data: note });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to cancel Debit Note.' } });
  }
};

export const getEligibleBills = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { partyId, noteType } = req.query;
    if (!partyId) {
      res.status(400).json({ error: { message: 'partyId query parameter is required.' } });
      return;
    }

    const bills = await debitNoteService.getEligibleBills(
      companyId,
      financialYearId,
      partyId as string,
      (noteType as string) || 'SALES'
    );
    res.status(200).json({ data: bills });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get eligible bills.' } });
  }
};

export const getPreviousAndNextNote = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { id } = req.params;
    const nav = await debitNoteService.getPreviousAndNext(companyId, financialYearId, id);
    res.status(200).json({ data: nav });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get navigation notes.' } });
  }
};


export const getNextDebitNoteNumber = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { bookId } = req.query;
    if (!bookId) {
      res.status(400).json({ error: { message: 'bookId query parameter is required.' } });
      return;
    }

    const next = await debitNoteService.getNextNumber(companyId, financialYearId, bookId as string);
    res.status(200).json({ data: next });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get next Debit Note number.' } });
  }
};

export const getDebitNoteSummary = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const summary = await debitNoteService.getSummary(companyId, financialYearId);
    res.status(200).json({ data: summary });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get Debit Note summary.' } });
  }
};

export const getDebitNotePartyBalance = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { partyId } = req.query;
    if (!partyId) {
      res.status(400).json({ error: { message: 'partyId query parameter is required.' } });
      return;
    }

    const balance = await debitNoteService.getPartyBalance(companyId, financialYearId, partyId as string);
    res.status(200).json({ data: balance });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get party balance.' } });
  }
};

export const getDebitNotePrintRange = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { bookId, from, to, partyId } = req.query;
    const fromNumber = parseInt(String(from ?? ''), 10);
    const toNumber = parseInt(String(to ?? ''), 10);
    if (!Number.isFinite(fromNumber) || !Number.isFinite(toNumber)) {
      res.status(400).json({ error: { message: 'from and to query parameters are required.' } });
      return;
    }

    const notes = await debitNoteService.getPrintRange(companyId, financialYearId, {
      bookId: bookId as string | undefined,
      from: fromNumber,
      to: toNumber,
      partyId: partyId as string | undefined,
    });
    res.status(200).json({ data: notes });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to load print range.' } });
  }
};