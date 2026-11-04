import { Router } from 'express';
import {
  validateContext,
  getNextNumbers,
  createProductionReceive,
  lookupProductionReceiveByChallanNumber,
  getProductionReceiveById,
  listProductionReceives,
  updateProductionReceive,
  cancelProductionReceive,
  getProductionReceiveNavigation,
} from '../controllers/productionReceiveController.js';

const router = Router();

router.get('/validate-context', validateContext);
router.get('/next-number', getNextNumbers);
router.get('/lookup', lookupProductionReceiveByChallanNumber);
router.post('/', createProductionReceive);
router.get('/:id/navigation', getProductionReceiveNavigation);
router.patch('/:id/cancel', cancelProductionReceive);
router.patch('/:id', updateProductionReceive);
router.get('/:id', getProductionReceiveById);
router.get('/', listProductionReceives);

export default router;

