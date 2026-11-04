import { Router } from 'express';
import { verifyGSTIN, getGSTINProviderStatus, saveSupplierToPartyMaster } from '../controllers/gstinController.js';

const router = Router();

router.get('/status', getGSTINProviderStatus);
router.get('/verify/:gstin', verifyGSTIN);
router.post('/verify', verifyGSTIN);
router.post('/save-to-party-master', saveSupplierToPartyMaster);

export default router;

