import { Router } from 'express';
import {
  getReportOptions,
  runReport,
  exportReportXlsx,
  getReportItemDetails,
} from '../controllers/reportController.js';

const router = Router();

// Phase 15 - Sales & Purchase Report (Bill Base)
router.get('/bill-base/options', getReportOptions);
router.post('/bill-base/run', runReport);
router.post('/bill-base/export', exportReportXlsx);
router.get('/bill-base/item-details', getReportItemDetails);

export default router;
