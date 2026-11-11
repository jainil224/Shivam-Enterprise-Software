import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import companyRoutes from './companyRoutes.js';
import financialYearRoutes from './financialYearRoutes.js';
import masterRoutes from './masterRoutes.js';
import reportMasterRoutes from './reportMasterRoutes.js';
import productionReceiveRoutes from './productionReceiveRoutes.js';
import gstinRoutes from './gstinRoutes.js';
import purchaseBillRoutes from './purchaseBillRoutes.js';
import ledgerAccountRoutes from './ledgerAccountRoutes.js';
import { createBankVoucherRoutes } from './bankVoucherRoutes.js';
import itemRoutes from './itemRoutes.js';
import salesOrderRoutes from './salesOrderRoutes.js';
import purchaseOrderRoutes from './purchaseOrderRoutes.js';
import debitNoteBookRoutes from './debitNoteBookRoutes.js';
import debitNoteRoutes from './debitNoteRoutes.js';
import reportRoutes from './reportRoutes.js';

const router = Router();

// System Health routes
router.use('/health', healthRoutes);

// Company & Financial Year Management
router.use('/companies', companyRoutes);
router.use('/financial-years', financialYearRoutes);

// Master Management (Phase 5)
router.use('/masters', masterRoutes);
router.use('/masters', reportMasterRoutes);

// Manufacturing & Production Receive (Phase 7)
router.use('/manufacturing/production-receive', productionReceiveRoutes);

// GSTIN Verification (Phase 11)
router.use('/gstin', gstinRoutes);

// Transactions & Purchase Bills (Phase 11)
router.use('/transactions/purchase-bills', purchaseBillRoutes);

// Accounting Foundation & Bank Vouchers (Phase 12)
router.use('/ledger-accounts', ledgerAccountRoutes);
router.use('/bank-receipts', createBankVoucherRoutes('RECEIPT'));
router.use('/bank-payments', createBankVoucherRoutes('PAYMENT'));

// Item Master & Sales / Purchase Orders (Phase 13)
router.use('/items', itemRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);

// Debit Note Module (Phase 14)
router.use('/transactions/debit-note-books', debitNoteBookRoutes);
router.use('/debit-note-books', debitNoteBookRoutes);
router.use('/transactions/debit-notes', debitNoteRoutes);
router.use('/debit-notes', debitNoteRoutes);

// Sales & Purchase Report - Bill Base (Phase 15)
router.use('/reports', reportRoutes);

export default router;
