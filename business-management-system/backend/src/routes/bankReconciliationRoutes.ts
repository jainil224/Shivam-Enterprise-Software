// Phase 16 - Bank Reconciliation routes.

import { Router } from 'express';
import { bankReconciliationController } from '../controllers/bankReconciliationController.js';

const router = Router();

router.get('/banks', bankReconciliationController.listBanks);
router.get('/transactions', bankReconciliationController.listTransactions);
router.get('/summary', bankReconciliationController.getSummary);
router.get('/statement', bankReconciliationController.getStatement);

router.post('/opening-balance', bankReconciliationController.saveOpeningBalance);
router.post('/statement-balance', bankReconciliationController.saveStatementBalance);
router.post('/export/pdf', bankReconciliationController.exportPdf);

router.post('/:journalLineId/reconcile', bankReconciliationController.markReconciled);
router.delete('/:journalLineId/reconcile', bankReconciliationController.removeClearing);

router.get('/', bankReconciliationController.load);

export default router;