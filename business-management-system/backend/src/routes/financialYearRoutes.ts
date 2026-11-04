import { Router } from 'express';
import {
  updateFinancialYear,
  lockFinancialYear,
  unlockFinancialYear,
} from '../controllers/financialYearController.js';

const router = Router();

// Financial year management by FY id
router.patch('/:id', updateFinancialYear);
router.patch('/:id/lock', lockFinancialYear);
router.patch('/:id/unlock', unlockFinancialYear);

export default router;

