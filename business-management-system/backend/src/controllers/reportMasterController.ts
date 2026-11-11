import { Request, Response, NextFunction } from 'express';
import {
  PartyGroupService,
  AreaService,
  BrokerService,
  TransporterService,
  SalespersonService,
  ItemGroupService,
  PurchaseBookService,
} from '../services/reportMasterService.js';
import { getCompanyId } from './masterController.js';

const partyGroupService = new PartyGroupService();
const areaService = new AreaService();
const brokerService = new BrokerService();
const transporterService = new TransporterService();
const salespersonService = new SalespersonService();
const itemGroupService = new ItemGroupService();
const purchaseBookService = new PurchaseBookService();

function listOptions(req: Request) {
  return {
    search: req.query.search as string | undefined,
    includeInactive: req.query.includeInactive === 'true',
  };
}

function listResponse(res: Response, data: unknown[]) {
  res.status(200).json({ success: true, count: data.length, data });
}

// -------------------------------------------------------------
// Party Group
// -------------------------------------------------------------
export const getPartyGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    listResponse(res, await partyGroupService.list(getCompanyId(req), listOptions(req)));
  } catch (err) {
    next(err);
  }
};

export const getPartyGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await partyGroupService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createPartyGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await partyGroupService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Party group created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updatePartyGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await partyGroupService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Party group updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setPartyGroupStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await partyGroupService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Party group ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getPartyGroupUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await partyGroupService.usage(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// Area
// -------------------------------------------------------------
export const getAreas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    listResponse(res, await areaService.list(getCompanyId(req), listOptions(req)));
  } catch (err) {
    next(err);
  }
};

export const getArea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await areaService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createArea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await areaService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Area created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateArea = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await areaService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Area updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setAreaStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await areaService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Area ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getAreaUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await areaService.usage(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// Broker
// -------------------------------------------------------------
export const getBrokers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    listResponse(res, await brokerService.list(getCompanyId(req), listOptions(req)));
  } catch (err) {
    next(err);
  }
};

export const getBroker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await brokerService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createBroker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await brokerService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Broker created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateBroker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await brokerService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Broker updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setBrokerStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await brokerService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Broker ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// Transporter
// -------------------------------------------------------------
export const getTransporters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    listResponse(res, await transporterService.list(getCompanyId(req), listOptions(req)));
  } catch (err) {
    next(err);
  }
};

export const getTransporter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await transporterService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createTransporter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await transporterService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Transporter created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateTransporter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await transporterService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Transporter updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setTransporterStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await transporterService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Transporter ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// Salesperson
// -------------------------------------------------------------
export const getSalespersons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    listResponse(res, await salespersonService.list(getCompanyId(req), listOptions(req)));
  } catch (err) {
    next(err);
  }
};

export const getSalesperson = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await salespersonService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createSalesperson = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await salespersonService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Salesperson created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateSalesperson = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await salespersonService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Salesperson updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setSalespersonStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await salespersonService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Salesperson ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// Item Group
// -------------------------------------------------------------
export const getItemGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    listResponse(res, await itemGroupService.list(getCompanyId(req), listOptions(req)));
  } catch (err) {
    next(err);
  }
};

export const getItemGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await itemGroupService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createItemGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await itemGroupService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Item group created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateItemGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await itemGroupService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Item group updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setItemGroupStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await itemGroupService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Item group ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getItemGroupUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await itemGroupService.usage(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// Purchase Book
// -------------------------------------------------------------
export const getPurchaseBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await purchaseBookService.list(
      getCompanyId(req),
      req.query.financialYearId as string | undefined,
      { includeInactive: req.query.includeInactive === 'true' }
    );
    listResponse(res, data);
  } catch (err) {
    next(err);
  }
};

export const getPurchaseBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await purchaseBookService.getById(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createPurchaseBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await purchaseBookService.create(getCompanyId(req), req.body);
    res.status(201).json({ success: true, message: 'Purchase book created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updatePurchaseBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await purchaseBookService.update(getCompanyId(req), req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Purchase book updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setPurchaseBookStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = req.body.isActive === true;
    const data = await purchaseBookService.setStatus(getCompanyId(req), req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Purchase book ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getPurchaseBookUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await purchaseBookService.usage(getCompanyId(req), req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};