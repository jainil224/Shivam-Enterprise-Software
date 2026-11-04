import { Router } from 'express';
import {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deactivateCompany,
  validateContext,
} from '../controllers/companyController.js';
import {
  getFinancialYears,
  createFinancialYear,
} from '../controllers/financialYearController.js';

const router = Router();

// Company management
router.get('/', getCompanies);
router.post('/', createCompany);
router.post('/validate-context', validateContext);
router.get('/:id', getCompany);
router.patch('/:id', updateCompany);
router.patch('/:id/deactivate', deactivateCompany);

// Nested financial year routes for specific company
router.get('/:companyId/financial-years', getFinancialYears);
router.post('/:companyId/financial-years', createFinancialYear);

export default router;

