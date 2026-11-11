import { Router } from 'express';
import {
  getPartyGroups, getPartyGroup, createPartyGroup, updatePartyGroup, setPartyGroupStatus, getPartyGroupUsage,
  getAreas, getArea, createArea, updateArea, setAreaStatus, getAreaUsage,
  getBrokers, getBroker, createBroker, updateBroker, setBrokerStatus,
  getTransporters, getTransporter, createTransporter, updateTransporter, setTransporterStatus,
  getSalespersons, getSalesperson, createSalesperson, updateSalesperson, setSalespersonStatus,
  getItemGroups, getItemGroup, createItemGroup, updateItemGroup, setItemGroupStatus, getItemGroupUsage,
  getPurchaseBooks, getPurchaseBook, createPurchaseBook, updatePurchaseBook, setPurchaseBookStatus, getPurchaseBookUsage,
} from '../controllers/reportMasterController.js';

const router = Router();

// Phase 15.2 - report master data (company scoped)
router.get('/party-groups', getPartyGroups);
router.get('/party-groups/:id/usage', getPartyGroupUsage);
router.get('/party-groups/:id', getPartyGroup);
router.post('/party-groups', createPartyGroup);
router.patch('/party-groups/:id/status', setPartyGroupStatus);
router.patch('/party-groups/:id', updatePartyGroup);

router.get('/areas', getAreas);
router.get('/areas/:id/usage', getAreaUsage);
router.get('/areas/:id', getArea);
router.post('/areas', createArea);
router.patch('/areas/:id/status', setAreaStatus);
router.patch('/areas/:id', updateArea);

router.get('/brokers', getBrokers);
router.get('/brokers/:id', getBroker);
router.post('/brokers', createBroker);
router.patch('/brokers/:id/status', setBrokerStatus);
router.patch('/brokers/:id', updateBroker);

router.get('/transporters', getTransporters);
router.get('/transporters/:id', getTransporter);
router.post('/transporters', createTransporter);
router.patch('/transporters/:id/status', setTransporterStatus);
router.patch('/transporters/:id', updateTransporter);

router.get('/salespersons', getSalespersons);
router.get('/salespersons/:id', getSalesperson);
router.post('/salespersons', createSalesperson);
router.patch('/salespersons/:id/status', setSalespersonStatus);
router.patch('/salespersons/:id', updateSalesperson);

router.get('/item-groups', getItemGroups);
router.get('/item-groups/:id/usage', getItemGroupUsage);
router.get('/item-groups/:id', getItemGroup);
router.post('/item-groups', createItemGroup);
router.patch('/item-groups/:id/status', setItemGroupStatus);
router.patch('/item-groups/:id', updateItemGroup);

router.get('/purchase-books', getPurchaseBooks);
router.get('/purchase-books/:id/usage', getPurchaseBookUsage);
router.get('/purchase-books/:id', getPurchaseBook);
router.post('/purchase-books', createPurchaseBook);
router.patch('/purchase-books/:id/status', setPurchaseBookStatus);
router.patch('/purchase-books/:id', updatePurchaseBook);

export default router;