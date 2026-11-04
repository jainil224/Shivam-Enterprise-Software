import { Router } from 'express';
import {
  getParties,
  getParty,
  createParty,
  updateParty,
  setPartyStatus,
  getMachines,
  createMachine,
  updateMachine,
  setMachineStatus,
  getOperators,
  createOperator,
  updateOperator,
  setOperatorStatus,
  getLocations,
  createLocation,
  updateLocation,
  setLocationStatus,
  getYarnQualities,
  createYarnQuality,
  updateYarnQuality,
  setYarnQualityStatus,
  getYarnGrades,
  createYarnGrade,
  updateYarnGrade,
  setYarnGradeStatus,
  getProductionBooks,
  createProductionBook,
  updateProductionBook,
  setProductionBookStatus,
} from '../controllers/masterController.js';

const router = Router();

// -------------------------------------------------------------
// 1. Party / Account Master
// -------------------------------------------------------------
router.get('/parties', getParties);
router.get('/parties/:id', getParty);
router.post('/parties', createParty);
router.patch('/parties/:id', updateParty);
router.patch('/parties/:id/status', setPartyStatus);

// -------------------------------------------------------------
// 2. Machine Master
// -------------------------------------------------------------
router.get('/machines', getMachines);
router.post('/machines', createMachine);
router.patch('/machines/:id', updateMachine);
router.patch('/machines/:id/status', setMachineStatus);

// -------------------------------------------------------------
// 3. Operator Master
// -------------------------------------------------------------
router.get('/operators', getOperators);
router.post('/operators', createOperator);
router.patch('/operators/:id', updateOperator);
router.patch('/operators/:id/status', setOperatorStatus);

// -------------------------------------------------------------
// 4. Location / Godown Master
// -------------------------------------------------------------
router.get('/locations', getLocations);
router.post('/locations', createLocation);
router.patch('/locations/:id', updateLocation);
router.patch('/locations/:id/status', setLocationStatus);

// -------------------------------------------------------------
// 5. Yarn Quality Master
// -------------------------------------------------------------
router.get('/yarn-qualities', getYarnQualities);
router.post('/yarn-qualities', createYarnQuality);
router.patch('/yarn-qualities/:id', updateYarnQuality);
router.patch('/yarn-qualities/:id/status', setYarnQualityStatus);

// -------------------------------------------------------------
// 6. Yarn Grade Master
// -------------------------------------------------------------
router.get('/yarn-grades', getYarnGrades);
router.post('/yarn-grades', createYarnGrade);
router.patch('/yarn-grades/:id', updateYarnGrade);
router.patch('/yarn-grades/:id/status', setYarnGradeStatus);

// -------------------------------------------------------------
// 7. Production Book Master
// -------------------------------------------------------------
router.get('/production-books', getProductionBooks);
router.post('/production-books', createProductionBook);
router.patch('/production-books/:id', updateProductionBook);
router.patch('/production-books/:id/status', setProductionBookStatus);

export default router;

