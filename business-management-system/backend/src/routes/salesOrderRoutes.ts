import { Router } from 'express';
import { createSalesOrderController } from '../controllers/orderController.js';

const router = Router();
const controller = createSalesOrderController();

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
router.post('/:id/confirm', controller.confirm);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/copy', controller.copy);

export default router;