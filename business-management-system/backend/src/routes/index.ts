import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import companyRoutes from './companyRoutes.js';
import financialYearRoutes from './financialYearRoutes.js';
import masterRoutes from './masterRoutes.js';
import productionReceiveRoutes from './productionReceiveRoutes.js';
import gstinRoutes from './gstinRoutes.js';
import purchaseBillRoutes from './purchaseBillRoutes.js';
import ledgerAccountRoutes from './ledgerAccountRoutes.js';
import { createBankVoucherRoutes } from './bankVoucherRoutes.js';

const router = Router();

// System Health routes
router.use('/health', healthRoutes);

// Company & Financial Year Management
router.use('/companies', companyRoutes);
router.use('/financial-years', financialYearRoutes);

// Master Management (Phase 5)
router.use('/masters', masterRoutes);

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

export default router;
