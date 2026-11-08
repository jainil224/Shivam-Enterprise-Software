import { Router } from 'express';
import {
  listDebitNoteBooks,
  getDebitNoteBookById,
  createDebitNoteBook,
} from '../controllers/debitNoteBookController.js';

const router = Router();

router.get('/', listDebitNoteBooks);
router.get('/:id', getDebitNoteBookById);
router.post('/', createDebitNoteBook);

export default router;

