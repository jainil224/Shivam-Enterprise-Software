import { Router } from 'express';
import {
  listDebitNotes,
  getDebitNoteById,
  createDebitNote,
  updateDebitNote,
  cancelDebitNote,
  getEligibleBills,
  getPreviousAndNextNote,
  getNextDebitNoteNumber,
  getDebitNoteSummary,
  getDebitNotePartyBalance,
  getDebitNotePrintRange,
} from '../controllers/debitNoteController.js';

const router = Router();

router.get('/', listDebitNotes);
router.get('/next-number', getNextDebitNoteNumber);
router.get('/summary', getDebitNoteSummary);
router.get('/eligible-bills', getEligibleBills);
router.get('/party-balance', getDebitNotePartyBalance);
router.get('/print-range', getDebitNotePrintRange);
router.get('/:id/navigation', getPreviousAndNextNote);
router.get('/:id', getDebitNoteById);
router.post('/', createDebitNote);
router.put('/:id', updateDebitNote);
router.post('/:id/cancel', cancelDebitNote);

export default router;