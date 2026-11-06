import { Router } from 'express';
import { createPurchaseOrderController } from '../controllers/orderController.js';

const router = Router();
const controller = createPurchaseOrderController();

router.get('/lookups', controller.getLookups);
router.get('/next-number', controller.getNextNumber);
router.get('/summary', controller.getSummary);
router.get('/reports', controller.listReports);
router.get('/reports/:reportKey', controller.runReport);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.get('/:id/history', controller.getHistory);
router.post('/:id/approve', controller.approve);
router.post('/:id/send', controller.send);
router.post('/:id/acknowledge', controller.acknowledge);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/copy', controller.copy);

export default router;