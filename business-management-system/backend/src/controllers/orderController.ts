import { NextFunction, Request, Response } from 'express';
import { OrderReportService } from '../services/orderReportService.js';
import { PurchaseOrderService } from '../services/purchaseOrderService.js';
import { SalesOrderService } from '../services/salesOrderService.js';
import { getCompanyId, getFinancialYearId } from './masterController.js';

const salesService = new SalesOrderService();
const purchaseService = new PurchaseOrderService();
const reportService = new OrderReportService();

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function guard(handler: Handler): Handler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

function reasonFrom(req: Request): unknown {
  return req.body?.reason ?? req.body?.cancellationReason;
}

export function createSalesOrderController() {
  return {
    getLookups: guard(async (req, res) => {
      const data = await salesService.getLookups(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    }),

    getNextNumber: guard(async (req, res) => {
      const data = await salesService.nextNumber(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    }),

    getSummary: guard(async (req, res) => {
      const data = await salesService.summary(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    }),

    list: guard(async (req, res) => {
      const data = await salesService.list(
        getCompanyId(req),
        getFinancialYearId(req),
        req.query as Record<string, unknown>
      );
      res.status(200).json({ success: true, ...data });
    }),

    getById: guard(async (req, res) => {
      const data = await salesService.getById(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({ success: true, data });
    }),

    getHistory: guard(async (req, res) => {
      const data = await salesService.history(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({ success: true, count: data.length, data });
    }),

    create: guard(async (req, res) => {
      const data = await salesService.create(
        getCompanyId(req),
        getFinancialYearId(req),
        req.body ?? {}
      );
      res.status(201).json({
        success: true,
        message: `Sales order ${data.orderNumber} saved as draft.`,
        data,
      });
    }),

    update: guard(async (req, res) => {
      const data = await salesService.update(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id,
        req.body ?? {}
      );
      res.status(200).json({
        success: true,
        message: `Sales order ${data.orderNumber} updated.`,
        data,
      });
    }),

    confirm: guard(async (req, res) => {
      const data = await salesService.confirm(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: `Sales order ${data.orderNumber} confirmed.`,
        data,
      });
    }),

    cancel: guard(async (req, res) => {
      const data = await salesService.cancel(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id,
        reasonFrom(req)
      );
      res.status(200).json({
        success: true,
        message: `Sales order ${data.orderNumber} cancelled.`,
        data,
      });
    }),

    copy: guard(async (req, res) => {
      const data = await salesService.copy(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(201).json({
        success: true,
        message: `Sales order ${data.orderNumber} created as a copy.`,
        data,
      });
    }),

    listReports: guard(async (_req, res) => {
      const data = reportService.salesList();
      res.status(200).json({ success: true, count: data.length, data });
    }),

    runReport: guard(async (req, res) => {
      const data = await reportService.runSales(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.reportKey,
        req.query
      );
      res.status(200).json({ success: true, data });
    }),
  };
}

export function createPurchaseOrderController() {
  return {
    getLookups: guard(async (req, res) => {
      const data = await purchaseService.getLookups(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    }),

    getNextNumber: guard(async (req, res) => {
      const data = await purchaseService.nextNumber(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    }),

    getSummary: guard(async (req, res) => {
      const data = await purchaseService.summary(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    }),

    list: guard(async (req, res) => {
      const data = await purchaseService.list(
        getCompanyId(req),
        getFinancialYearId(req),
        req.query as Record<string, unknown>
      );
      res.status(200).json({ success: true, ...data });
    }),

    getById: guard(async (req, res) => {
      const data = await purchaseService.getById(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({ success: true, data });
    }),

    getHistory: guard(async (req, res) => {
      const data = await purchaseService.history(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({ success: true, count: data.length, data });
    }),

    create: guard(async (req, res) => {
      const data = await purchaseService.create(
        getCompanyId(req),
        getFinancialYearId(req),
        req.body ?? {}
      );
      res.status(201).json({
        success: true,
        message: `Purchase order ${data.orderNumber} saved as draft.`,
        data,
      });
    }),

    update: guard(async (req, res) => {
      const data = await purchaseService.update(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id,
        req.body ?? {}
      );
      res.status(200).json({
        success: true,
        message: `Purchase order ${data.orderNumber} updated.`,
        data,
      });
    }),

    approve: guard(async (req, res) => {
      const data = await purchaseService.approve(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: `Purchase order ${data.orderNumber} approved.`,
        data,
      });
    }),

    send: guard(async (req, res) => {
      const data = await purchaseService.send(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: `Purchase order ${data.orderNumber} marked as sent.`,
        data,
      });
    }),

    acknowledge: guard(async (req, res) => {
      const data = await purchaseService.acknowledge(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({
        success: true,
        message: `Purchase order ${data.orderNumber} acknowledged.`,
        data,
      });
    }),

    cancel: guard(async (req, res) => {
      const data = await purchaseService.cancel(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id,
        reasonFrom(req)
      );
      res.status(200).json({
        success: true,
        message: `Purchase order ${data.orderNumber} cancelled.`,
        data,
      });
    }),

    copy: guard(async (req, res) => {
      const data = await purchaseService.copy(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(201).json({
        success: true,
        message: `Purchase order ${data.orderNumber} created as a copy.`,
        data,
      });
    }),

    listReports: guard(async (_req, res) => {
      const data = reportService.purchaseList();
      res.status(200).json({ success: true, count: data.length, data });
    }),

    runReport: guard(async (req, res) => {
      const data = await reportService.runPurchase(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.reportKey,
        req.query
      );
      res.status(200).json({ success: true, data });
    }),
  };
}