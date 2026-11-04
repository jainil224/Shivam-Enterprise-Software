import { Router } from 'express';
import { BankVoucherType } from '@prisma/client';
import { createBankVoucherController } from '../controllers/bankVoucherController.js';

export function createBankVoucherRoutes(voucherType: BankVoucherType): Router {
  const router = Router();
  const controller = createBankVoucherController(voucherType);

  router.get('/lookups', controller.getLookups);
  router.get('/next-number', controller.getNextNumber);
  router.get('/summary', controller.getSummary);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.post('/:id/cancel', controller.cancel);

  return router;
}