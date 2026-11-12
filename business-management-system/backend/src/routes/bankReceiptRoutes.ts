import { Router } from 'express';
import { bankReceiptController as controller } from '../controllers/bankReceiptController.js';

/**
 * Phase 18 - Bank Receipt Entry (Cheque Receipt).
 *
 * Mounted on /api/bank-receipts BEFORE the Phase 12 router. The POST / and
 * PUT /:id handlers call next() when the payload has no `lines` array, so the
 * legacy single-line Phase 12 contract keeps working through the same path.
 */
export const bankReceiptRoutes = Router();

// Receipt books
bankReceiptRoutes.get('/books', controller.listBooks);
bankReceiptRoutes.post('/books', controller.createBook);
bankReceiptRoutes.get('/books/:id', controller.getBook);
bankReceiptRoutes.put('/books/:id', controller.updateBook);

// Numbering
bankReceiptRoutes.get('/next-number', controller.getNextNumber);

// Lookups used by the entry screen
bankReceiptRoutes.get('/parties', controller.lookupParties);
bankReceiptRoutes.get('/adjustment-accounts', controller.lookupAdjustmentAccounts);
bankReceiptRoutes.get('/outstanding-bills', controller.outstandingBills);

// Validation / preview endpoints
bankReceiptRoutes.post('/validate-allocation', controller.validateAllocation);
bankReceiptRoutes.post('/adjustment-preview', controller.adjustmentPreview);
bankReceiptRoutes.post('/validate-adjustment', controller.validateAdjustment);

// Vouchers
bankReceiptRoutes.post('/', controller.create);
bankReceiptRoutes.put('/:id', controller.update);
bankReceiptRoutes.get('/:id/neighbours', controller.neighbours);

/**
 * Standalone book router so the selector / management screens can call
 * /api/bank-receipt-books without touching a voucher path.
 */
export const bankReceiptBookRoutes = Router();
bankReceiptBookRoutes.get('/', controller.listBooks);
bankReceiptBookRoutes.post('/', controller.createBook);
bankReceiptBookRoutes.get('/:id', controller.getBook);
bankReceiptBookRoutes.put('/:id', controller.updateBook);

/**
 * Company configurable Bank Name (instrument) master used by the Chq No /
 * Bank Name lookup on the receipt grid.
 */
export const bankInstrumentRoutes = Router();
bankInstrumentRoutes.get('/', controller.listInstruments);
bankInstrumentRoutes.post('/', controller.createInstrument);