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

export default router;
