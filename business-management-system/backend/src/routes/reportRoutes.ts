import { Router } from 'express';
import {
  getReportOptions,
  runReport,
  exportReportXlsx,
  exportReportPdf,
  getReportItemDetails,
  listReportColumnLayouts,
  getReportColumnLayout,
  createReportColumnLayout,
  updateReportColumnLayout,
  deleteReportColumnLayout,
  setDefaultReportColumnLayout,
} from '../controllers/reportController.js';
import {
  getBankBookOptions,
  runBankBook,
  exportBankBookXlsx,
  exportBankBookPdf,
  listBankBookSavedReports,
  createBankBookSavedReport,
  updateBankBookSavedReport,
  deleteBankBookSavedReport,
} from '../controllers/bankBookController.js';
import {
  getAccountLedgerOptions,
  runAccountLedger,
  exportAccountLedgerXlsx,
  exportAccountLedgerPdf,
} from '../controllers/accountLedgerController.js';
import {
  getAccountWiseBalanceOptions,
  queryAccountWiseBalance,
  queryAccountWiseBalanceMonthWise,
  exportAccountWiseBalancePdf,
  exportAccountWiseBalanceMonthWisePdf,
} from '../controllers/accountWiseBalanceController.js';

const router = Router();

// Phase 15 - Sales & Purchase Report (Bill Base)
router.get('/bill-base/options', getReportOptions);
router.post('/bill-base/run', runReport);
router.post('/bill-base/export', exportReportXlsx);
router.post('/bill-base/export/pdf', exportReportPdf);
router.get('/bill-base/item-details', getReportItemDetails);

// Phase 15.1 - persistent, company-scoped column layouts
router.get('/column-layouts', listReportColumnLayouts);
router.get('/column-layouts/:id', getReportColumnLayout);
router.post('/column-layouts', createReportColumnLayout);
router.put('/column-layouts/:id', updateReportColumnLayout);
router.delete('/column-layouts/:id', deleteReportColumnLayout);
router.post('/column-layouts/:id/default', setDefaultReportColumnLayout);

// Phase 17 - Bank Book report (read-only)
router.get('/bank-book/options', getBankBookOptions);
router.post('/bank-book/run', runBankBook);
router.post('/bank-book/export', exportBankBookXlsx);
router.post('/bank-book/export/pdf', exportBankBookPdf);
router.get('/bank-book/saved', listBankBookSavedReports);
router.post('/bank-book/saved', createBankBookSavedReport);
router.put('/bank-book/saved/:id', updateBankBookSavedReport);
router.delete('/bank-book/saved/:id', deleteBankBookSavedReport);

// Phase 17 - Account Ledger report (read-only)
router.get('/account-ledger/options', getAccountLedgerOptions);
router.post('/account-ledger/run', runAccountLedger);
router.post('/account-ledger/export', exportAccountLedgerXlsx);
router.post('/account-ledger/export/pdf', exportAccountLedgerPdf);

// Phase 19 - Account Wise Balance report (read-only, Phase 1)
router.get('/account-wise-balance/options', getAccountWiseBalanceOptions);
router.post('/account-wise-balance/query', queryAccountWiseBalance);
router.post('/account-wise-balance/export/pdf', exportAccountWiseBalancePdf);
router.post('/account-wise-balance/month-wise/query', queryAccountWiseBalanceMonthWise);
router.post('/account-wise-balance/month-wise/export/pdf', exportAccountWiseBalanceMonthWisePdf);

export default router;
