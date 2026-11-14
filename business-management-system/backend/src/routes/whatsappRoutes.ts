// Phase 19.3 - WhatsApp QR integration routes.
// Mounted at /api/integrations/whatsapp by the route registry.

import { Router } from 'express';
import { whatsappController } from '../controllers/whatsappController.js';

const router = Router();

router.get('/status', whatsappController.status);
router.post('/connect', whatsappController.connect);
router.get('/qr', whatsappController.qr);
router.post('/disconnect', whatsappController.disconnect);
router.post('/send-document', whatsappController.sendDocument);
router.get('/history', whatsappController.history);
router.get('/history/:id', whatsappController.historyById);

export default router;