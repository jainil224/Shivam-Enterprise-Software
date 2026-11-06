import { NextFunction, Request, Response } from 'express';
import { ItemService } from '../services/itemService.js';
import { getCompanyId } from './masterController.js';

const service = new ItemService();

export const getItemLookups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await service.getLookups(companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getItemSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await service.summary(companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const listItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await service.list(companyId, req.query);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const getItemById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await service.getById(companyId, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await service.create(companyId, req.body ?? {});
    res.status(201).json({
      success: true,
      message: `Item ${data.itemCode} - ${data.itemName} saved successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await service.update(companyId, req.params.id, req.body ?? {});
    res.status(200).json({
      success: true,
      message: `Item ${data.itemCode} - ${data.itemName} updated successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const setItemStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body?.isActive;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: { message: 'isActive must be a boolean value.' },
      });
      return;
    }
    const data = await service.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Item ${data.itemCode} is now ${data.isActive ? 'active' : 'inactive'}.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};