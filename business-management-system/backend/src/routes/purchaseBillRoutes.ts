import { Router } from 'express';
import {
  createPurchaseBill,
  getPurchaseBillById,
  getPurchaseBillByChallanId,
  listPurchaseBills,
} from '../controllers/purchaseBillController.js';

const router = Router();

router.post('/', createPurchaseBill);
router.get('/', listPurchaseBills);
router.get('/by-challan/:challanId', getPurchaseBillByChallanId);
router.get('/:id', getPurchaseBillById);

export default router;

