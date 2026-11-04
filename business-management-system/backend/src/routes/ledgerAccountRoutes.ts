import { Router } from 'express';
import {
  createLedgerAccount,
  getLedgerAccountById,
  listLedgerAccounts,
  setLedgerAccountStatus,
  updateLedgerAccount,
} from '../controllers/ledgerAccountController.js';

const router = Router();

router.get('/', listLedgerAccounts);
router.post('/', createLedgerAccount);
router.get('/:id', getLedgerAccountById);
router.put('/:id', updateLedgerAccount);
router.patch('/:id/status', setLedgerAccountStatus);

export default router;