import { PrismaClient, Prisma } from '@prisma/client';
import { purchaseBillRepository } from '../repositories/purchaseBillRepository.js';
import { GSTIN_REGEX, STATE_CODE_MAP } from './gstin/gstinTypes.js';

const prisma = new PrismaClient();

export interface CreatePurchaseBillPayload {
  billDate?: string;
  sourceChallanId?: string | null;
  partyId?: string | null;
  bookId?: string | null;
  brokerId?: string | null;
  transporterId?: string | null;
  salespersonId?: string | null;
  deliveryPartyId?: string | null;
  vehicleNumber?: string | null;
  supplierGstin?: string | null;
  supplierLegalName: string;
  supplierTradeName?: string | null;
  supplierAddress?: string | null;
  supplierState?: string | null;
  supplierStateCode?: string | null;
  supplierPincode?: string | null;
  supplierCity?: string | null;
  verificationSource?: string;
  verificationTimestamp?: string | null;
  isVerifiedSupplier?: boolean;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  placeOfSupply?: string | null;
  gstRate?: number; // e.g. 5, 12, 18, 0
  items: Array<{
    itemId?: string | null;
    itemDescription: string;
    hsnCode?: string | null;
    quantity: number;
    unit?: string;
    rate: number;
    discount?: number;
    cartonNumber?: string | null;
    lotNumber?: string | null;
    grade?: string | null;
    yarnQualityId?: string | null;
    yarnGradeId?: string | null;
    cops?: number | null;
  }>;
  remarks?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuidOrNull(value: string | null | undefined, field: string): string | null {
  if (!value) return null;
  if (!UUID_PATTERN.test(value)) {
    const err: any = new Error(`${field} must be a valid identifier.`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

export class PurchaseBillService {
  /**
   * Create purchase bill from payload with business validation and GST calculations
   */
  async createBill(companyId: string, financialYearId: string, payload: CreatePurchaseBillPayload) {
    // 1. Verify Company & Financial Year
    const [company, fy] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.financialYear.findUnique({
        where: { companyId_id: { companyId, id: financialYearId } },
      }),
    ]);

    if (!company) {
      const err: any = new Error('Company not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!fy) {
      const err: any = new Error('Financial year not found for this company.');
      err.statusCode = 404;
      throw err;
    }

    if (fy.isLocked) {
      const err: any = new Error(`Cannot create purchase bill in locked financial year '${fy.yearName}'.`);
      err.statusCode = 403;
      throw err;
    }

    // 2. Validate Source Challan if provided
    let sourceChallan: any = null;
    if (payload.sourceChallanId) {
      sourceChallan = await prisma.productionReceive.findFirst({
        where: {
          id: payload.sourceChallanId,
          companyId,
        },
        include: {
          items: true,
          financialYear: true,
          productionBook: true,
        },
      });

      if (!sourceChallan) {
        const err: any = new Error('Source production challan not found in active company.');
        err.statusCode = 404;
        throw err;
      }

      if (sourceChallan.financialYearId !== financialYearId) {
        const err: any = new Error('Source challan belongs to a different financial year.');
        err.statusCode = 400;
        throw err;
      }

      if (sourceChallan.status === 'CANCELLED') {
        const err: any = new Error('Cannot create purchase bill from a CANCELLED production challan.');
        err.statusCode = 400;
        throw err;
      }

      // Check if bill already exists for this challan
      const existingBill = await purchaseBillRepository.findByChallanId(companyId, sourceChallan.id);
      if (existingBill) {
        const err: any = new Error(
          `Purchase Bill '${existingBill.billNumber}' has already been created for Challan #${sourceChallan.challanNumber}.`
        );
        err.statusCode = 409;
        err.existingBill = existingBill;
        throw err;
      }
    }

    // 3. Validate Supplier Info
    const supplierLegalName = payload.supplierLegalName?.trim();
    if (!supplierLegalName) {
      const err: any = new Error('Supplier Legal Name is required.');
      err.statusCode = 400;
      throw err;
    }

    let supplierGstin = payload.supplierGstin ? payload.supplierGstin.trim().toUpperCase() : null;
    if (supplierGstin && !GSTIN_REGEX.test(supplierGstin)) {
      const err: any = new Error('Invalid Supplier GSTIN format.');
      err.statusCode = 400;
      throw err;
    }

    // Derive or validate state code
    let supplierStateCode = payload.supplierStateCode?.trim();
    if (!supplierStateCode && supplierGstin) {
      supplierStateCode = supplierGstin.substring(0, 2);
    }

    let supplierState = payload.supplierState?.trim();
    if (!supplierState && supplierStateCode) {
      supplierState = STATE_CODE_MAP[supplierStateCode] || 'Gujarat';
    }

    // Determine company state code (Company GSTIN first 2 digits or fallback)
    const companyGstin = company.gstin ? company.gstin.trim().toUpperCase() : '';
    const companyStateCode = companyGstin ? companyGstin.substring(0, 2) : '24'; // Default 24 (Gujarat)

    // 3b. Validate Phase 15.2 master references (company + financial year scoped)
    const bookId = assertUuidOrNull(payload.bookId, 'Purchase book');
    const brokerId = assertUuidOrNull(payload.brokerId, 'Broker');
    const transporterId = assertUuidOrNull(payload.transporterId, 'Transporter');
    const salespersonId = assertUuidOrNull(payload.salespersonId, 'Salesperson');
    const deliveryPartyId = assertUuidOrNull(payload.deliveryPartyId, 'Delivery party');

    if (bookId) {
      const book = await prisma.purchaseBook.findFirst({
        where: { id: bookId, companyId, financialYearId },
        select: { id: true },
      });
      if (!book) {
        const err: any = new Error('Selected purchase book does not belong to the active company and financial year.');
        err.statusCode = 400;
        err.field = 'bookId';
        throw err;
      }
    }

    const masterChecks: Array<{ field: string; id: string | null; model: 'broker' | 'transporter' | 'salesperson' }> = [
      { field: 'brokerId', id: brokerId, model: 'broker' },
      { field: 'transporterId', id: transporterId, model: 'transporter' },
      { field: 'salespersonId', id: salespersonId, model: 'salesperson' },
    ];
    for (const check of masterChecks) {
      if (!check.id) continue;
      const where = { id: check.id, companyId } as any;
      const found =
        check.model === 'broker'
          ? await prisma.broker.findFirst({ where, select: { id: true } })
          : check.model === 'transporter'
            ? await prisma.transporter.findFirst({ where, select: { id: true } })
            : await prisma.salesperson.findFirst({ where, select: { id: true } });
      if (!found) {
        const err: any = new Error(`Selected ${check.model} does not belong to the active company.`);
        err.statusCode = 400;
        err.field = check.field;
        throw err;
      }
    }

    if (deliveryPartyId) {
      const deliveryParty = await prisma.party.findFirst({
        where: { id: deliveryPartyId, companyId },
        select: { id: true },
      });
      if (!deliveryParty) {
        const err: any = new Error('Selected delivery party does not belong to the active company.');
        err.statusCode = 400;
        err.field = 'deliveryPartyId';
        throw err;
      }
    }

    // 4. Validate Items & Compute Decimal Totals
    const rawItems = payload.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      const err: any = new Error('At least one item is required in the Purchase Bill.');
      err.statusCode = 400;
      throw err;
    }

    let totalQuantity = 0;
    let totalTaxableAmount = 0;

    const calculatedItems = rawItems.map((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const discount = Number(item.discount) || 0;

      if (qty <= 0) {
        const err: any = new Error(`Item #${idx + 1}: Quantity must be greater than 0.`);
        err.statusCode = 400;
        throw err;
      }

      if (rate < 0) {
        const err: any = new Error(`Item #${idx + 1}: Rate cannot be negative.`);
        err.statusCode = 400;
        throw err;
      }

      // Taxable Value = Quantity * Rate - Discount
      const lineTaxable = Math.max(0, Math.round((qty * rate - discount) * 100) / 100);

      totalQuantity += qty;
      totalTaxableAmount += lineTaxable;

      return {
        itemId: assertUuidOrNull(item.itemId, `Item #${idx + 1} item`),
        itemDescription: item.itemDescription || 'Texturised Polyester Yarn',
        hsnCode: item.hsnCode || '5402',
        quantity: qty,
        unit: item.unit || 'KG',
        rate,
        discount,
        taxableAmount: lineTaxable,
        cartonNumber: item.cartonNumber || null,
        lotNumber: item.lotNumber || null,
        grade: item.grade || null,
        yarnQualityId: assertUuidOrNull(item.yarnQualityId, `Item #${idx + 1} yarn quality`),
        yarnGradeId: assertUuidOrNull(item.yarnGradeId, `Item #${idx + 1} yarn grade`),
        cops: item.cops !== undefined && item.cops !== null ? Number(item.cops) : null,
      };
    });

    totalTaxableAmount = Math.round(totalTaxableAmount * 100) / 100;
    totalQuantity = Math.round(totalQuantity * 1000) / 1000;

    // 4b. Every line-level master reference must belong to the active company.
    const lineItemIds = [...new Set(calculatedItems.map((line) => line.itemId).filter((id): id is string => Boolean(id)))];
    if (lineItemIds.length > 0) {
      const found = await prisma.item.count({ where: { companyId, id: { in: lineItemIds } } });
      if (found !== lineItemIds.length) {
        const err: any = new Error('One or more line items do not belong to the active company.');
        err.statusCode = 400;
        err.field = 'items';
        throw err;
      }
    }

    const qualityIds = [...new Set(calculatedItems.map((line) => line.yarnQualityId).filter((id): id is string => Boolean(id)))];
    if (qualityIds.length > 0) {
      const found = await prisma.yarnQuality.count({ where: { companyId, id: { in: qualityIds } } });
      if (found !== qualityIds.length) {
        const err: any = new Error('One or more yarn qualities do not belong to the active company.');
        err.statusCode = 400;
        err.field = 'items';
        throw err;
      }
    }

    const gradeIds = [...new Set(calculatedItems.map((line) => line.yarnGradeId).filter((id): id is string => Boolean(id)))];
    if (gradeIds.length > 0) {
      const found = await prisma.yarnGrade.count({ where: { companyId, id: { in: gradeIds } } });
      if (found !== gradeIds.length) {
        const err: any = new Error('One or more yarn grades do not belong to the active company.');
        err.statusCode = 400;
        err.field = 'items';
        throw err;
      }
    }

    // 5. GST Calculations (Intra-state CGST+SGST vs Inter-state IGST)
    const gstRate = payload.gstRate !== undefined ? Number(payload.gstRate) : 5; // Default 5% for polyester yarn
    const isIntraState = supplierStateCode === companyStateCode;

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (gstRate > 0) {
      if (isIntraState) {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = Math.round(((totalTaxableAmount * cgstRate) / 100) * 100) / 100;
        sgstAmount = Math.round(((totalTaxableAmount * sgstRate) / 100) * 100) / 100;
      } else {
        igstRate = gstRate;
        igstAmount = Math.round(((totalTaxableAmount * igstRate) / 100) * 100) / 100;
      }
    }

    const totalBeforeRound = totalTaxableAmount + cgstAmount + sgstAmount + igstAmount;
    const finalTotal = Math.round(totalBeforeRound);
    const roundOff = Math.round((finalTotal - totalBeforeRound) * 100) / 100;

    // 6. Dates
    const billDate = payload.billDate ? new Date(payload.billDate) : new Date();
    const invoiceDate = payload.supplierInvoiceDate ? new Date(payload.supplierInvoiceDate) : null;

    // 7. Persist via repository
    const created = await purchaseBillRepository.create({
      companyId,
      financialYearId,
      billDate,
      sourceChallanId: payload.sourceChallanId || null,
      partyId: payload.partyId || null,
      bookId,
      brokerId,
      transporterId,
      salespersonId,
      deliveryPartyId,
      vehicleNumber: payload.vehicleNumber?.trim().toUpperCase() || null,
      supplierGstin,
      supplierLegalName,
      supplierTradeName: payload.supplierTradeName || null,
      supplierAddress: payload.supplierAddress || null,
      supplierState,
      supplierStateCode,
      supplierPincode: payload.supplierPincode || null,
      supplierCity: payload.supplierCity || null,
      verificationSource: payload.verificationSource || 'MANUAL_UNVERIFIED',
      verificationTimestamp: payload.verificationTimestamp ? new Date(payload.verificationTimestamp) : null,
      isVerifiedSupplier: Boolean(payload.isVerifiedSupplier),
      supplierInvoiceNumber: payload.supplierInvoiceNumber || null,
      supplierInvoiceDate: invoiceDate,
      placeOfSupply: payload.placeOfSupply || supplierState || 'Gujarat',
      totalQuantity,
      taxableAmount: totalTaxableAmount,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      roundOff,
      totalAmount: finalTotal,
      remarks: payload.remarks || null,
      items: calculatedItems,
    });

    return created;
  }

  /**
   * Get bill by ID
   */
  async getBillById(companyId: string, id: string) {
    const bill = await purchaseBillRepository.findById(companyId, id);
    if (!bill) {
      const err: any = new Error('Purchase Bill not found.');
      err.statusCode = 404;
      throw err;
    }
    return bill;
  }

  /**
   * Get bill by source challan ID
   */
  async getBillByChallanId(companyId: string, challanId: string) {
    return purchaseBillRepository.findByChallanId(companyId, challanId);
  }

  /**
   * List paginated bills
   */
  async listBills(companyId: string, params: any) {
    return purchaseBillRepository.findPaginated(companyId, params);
  }
}

export const purchaseBillService = new PurchaseBillService();

