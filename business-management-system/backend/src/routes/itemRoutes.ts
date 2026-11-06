import { Router } from 'express';
import {
  createItem,
  getItemById,
  getItemLookups,
  getItemSummary,
  listItems,
  setItemStatus,
  updateItem,
} from '../controllers/itemController.js';

const router = Router();

router.get('/lookups', getItemLookups);
router.get('/summary', getItemSummary);
router.get('/', listItems);
router.post('/', createItem);
router.get('/:id', getItemById);
router.put('/:id', updateItem);
router.patch('/:id/status', setItemStatus);

export default router;