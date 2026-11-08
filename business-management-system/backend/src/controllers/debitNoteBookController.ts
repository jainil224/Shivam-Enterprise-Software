import { Request, Response } from 'express';
import { debitNoteBookService } from '../services/debitNoteBookService.js';

export const listDebitNoteBooks = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const includeInactive = req.query.includeInactive === 'true';
    const books = await debitNoteBookService.listBooks(companyId, financialYearId, { includeInactive });
    res.status(200).json({ data: books });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to list Debit Note Books.' } });
  }
};

export const getDebitNoteBookById = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const { id } = req.params;
    const book = await debitNoteBookService.getBookById(companyId, financialYearId, id);
    res.status(200).json({ data: book });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to get Debit Note Book.' } });
  }
};

export const createDebitNoteBook = async (req: Request, res: Response) => {
  try {
    const companyId = req.headers['x-company-id'] as string;
    const financialYearId = req.headers['x-financial-year-id'] as string;
    if (!companyId || !financialYearId) {
      res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
      return;
    }

    const book = await debitNoteBookService.createBook(companyId, financialYearId, req.body);
    res.status(201).json({ data: book });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: { message: err.message || 'Failed to create Debit Note Book.' } });
  }
};

