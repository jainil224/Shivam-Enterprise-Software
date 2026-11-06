import React, { useEffect, useState } from 'react';
import { AlertCircle, Package, Save, X } from 'lucide-react';
import { createItem, updateItem } from '../services/api';
import {
  ITEM_TYPE_LABELS,
  Item,
  ItemLookups,
  ItemPayload,
  ItemType,
  UNIT_LABELS,
  UnitOfMeasure,
} from '../types/orders';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemToEdit?: Item | null;
  lookups: ItemLookups | null;
}

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40';
const errorInputCls = 'border-rose-500 ring-1 ring-rose-500';

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  itemToEdit,
  lookups,
}) => {
  const isEditing = Boolean(itemToEdit);

  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemType, setItemType] = useState<ItemType>('YARN');
  const [unit, setUnit] = useState<UnitOfMeasure>('KG');
  const [hsnCode, setHsnCode] = useState('');
  const [gstRate, setGstRate] = useState('18.00');
  const [defaultSalesRate, setDefaultSalesRate] = useState('0.0000');
  const [defaultPurchaseRate, setDefaultPurchaseRate] = useState('0.0000');
  const [yarnQualityId, setYarnQualityId] = useState('');
  const [yarnGradeId, setYarnGradeId] = useState('');
  const [yarnCount, setYarnCount] = useState('');
  const [denier, setDenier] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [fabricDesign, setFabricDesign] = useState('');
  const [colour, setColour] = useState('');
  const [sizeSpecification, setSizeSpecification] = useState('');
  const [description, setDescription] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (itemToEdit) {
      setItemCode(itemToEdit.itemCode ?? '');
      setItemName(itemToEdit.itemName ?? '');
      setItemCategory(itemToEdit.itemCategory ?? '');
      setItemType(itemToEdit.itemType ?? 'YARN');
      setUnit(itemToEdit.unit ?? 'KG');
      setHsnCode(itemToEdit.hsnCode ?? '');
      setGstRate(String(itemToEdit.gstRate ?? '18.00'));
      setDefaultSalesRate(String(itemToEdit.defaultSalesRate ?? '0.0000'));
      setDefaultPurchaseRate(String(itemToEdit.defaultPurchaseRate ?? '0.0000'));
      setYarnQualityId(itemToEdit.yarnQualityId ?? '');
      setYarnGradeId(itemToEdit.yarnGradeId ?? '');
      setYarnCount(itemToEdit.yarnCount ?? '');
      setDenier(itemToEdit.denier ?? '');
      setLotNumber(itemToEdit.lotNumber ?? '');
      setFabricType(itemToEdit.fabricType ?? '');
      setFabricDesign(itemToEdit.fabricDesign ?? '');
      setColour(itemToEdit.colour ?? '');
      setSizeSpecification(itemToEdit.sizeSpecification ?? '');
      setDescription(itemToEdit.description ?? '');
    } else {
      setItemCode('');
      setItemName('');
      setItemCategory('');
      setItemType('YARN');
      setUnit('KG');
      setHsnCode('');
      setGstRate('18.00');
      setDefaultSalesRate('0.0000');
      setDefaultPurchaseRate('0.0000');
      setYarnQualityId('');
      setYarnGradeId('');
      setYarnCount('');
      setDenier('');
      setLotNumber('');
      setFabricType('');
      setFabricDesign('');
      setColour('');
      setSizeSpecification('');
      setDescription('');
    }

    setFieldErrors({});
    setGeneralError(null);
    setIsSubmitting(false);
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSubmitting) return;

    const errors: Record<string, string> = {};
    if (itemCode.trim() === '') errors.itemCode = 'Item code is required.';
    if (itemName.trim() === '') errors.itemName = 'Item name is required.';
    if (gstRate.trim() === '' || Number.isNaN(Number(gstRate))) {
      errors.gstRate = 'GST rate must be a number between 0 and 100.';
    } else if (Number(gstRate) < 0 || Number(gstRate) > 100) {
      errors.gstRate = 'GST rate must be between 0 and 100.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: ItemPayload = {
      itemCode: itemCode.trim().toUpperCase(),
      itemName: itemName.trim(),
      itemCategory: itemCategory.trim() || null,
      itemType,
      unit,
      hsnCode: hsnCode.trim() || null,
      gstRate,
      defaultSalesRate,
      defaultPurchaseRate,
      yarnQualityId: yarnQualityId || null,
      yarnGradeId: yarnGradeId || null,
      yarnCount: yarnCount.trim() || null,
      denier: denier.trim() || null,
      lotNumber: lotNumber.trim() || null,
      fabricType: fabricType.trim() || null,
      fabricDesign: fabricDesign.trim() || null,
      colour: colour.trim() || null,
      sizeSpecification: sizeSpecification.trim() || null,
      description: description.trim() || null,
    };

    setIsSubmitting(true);
    setGeneralError(null);
    try {
      if (isEditing && itemToEdit) {
        await updateItem(itemToEdit.id, payload);
      } else {
        await createItem(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      if (apiErrors && apiErrors.length > 0) {
        const mapped: Record<string, string> = {};
        for (const entry of apiErrors) {
          mapped[entry.field] = entry.message;
        }
        setFieldErrors(mapped);
      }
      setGeneralError(err instanceof Error ? err.message : 'Failed to save the item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const yarnFields = itemType === 'YARN' || itemType === 'RAW_MATERIAL';
  const fabricFields = itemType === 'FABRIC';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-3 py-6 overflow-y-auto">
      <div className="w-full max-w-[900px] bg-white rounded-lg shadow-xl border border-slate-300">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-[#2c5f57] text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <h2 className="text-[13px] font-bold">
              {isEditing ? `Edit Item — ${itemToEdit?.itemCode}` : 'New Item Master'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/15"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 space-y-3">
          {generalError && (
            <div className="bg-red-50 border border-red-300 text-red-800 rounded px-2.5 py-1.5 text-[11.5px] font-semibold flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <label className={labelCls} htmlFor="itemCode">
                Item Code *
              </label>
              <input
                id="itemCode"
                value={itemCode}
                onChange={(event) => setItemCode(event.target.value)}
                placeholder="YRN-150-001"
                className={`${inputCls} font-mono uppercase ${fieldErrors.itemCode ? errorInputCls : ''}`}
              />
              {fieldErrors.itemCode && (
                <p className="text-[10.5px] text-rose-600 mt-0.5">{fieldErrors.itemCode}</p>
              )}
            </div>

            <div className="col-span-2">
              <label className={labelCls} htmlFor="itemName">
                Item Name *
              </label>
              <input
                id="itemName"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="150 Denier Texturised Polyester Yarn"
                className={`${inputCls} ${fieldErrors.itemName ? errorInputCls : ''}`}
              />
              {fieldErrors.itemName && (
                <p className="text-[10.5px] text-rose-600 mt-0.5">{fieldErrors.itemName}</p>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="itemType">
                Item Type
              </label>
              <select
                id="itemType"
                value={itemType}
                onChange={(event) => setItemType(event.target.value as ItemType)}
                className={inputCls}
              >
                {(lookups?.itemTypes ?? (['YARN', 'RAW_MATERIAL', 'FABRIC', 'OTHER'] as ItemType[])).map(
                  (type) => (
                    <option key={type} value={type}>
                      {ITEM_TYPE_LABELS[type]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="itemCategory">
                Category
              </label>
              <input
                id="itemCategory"
                value={itemCategory}
                onChange={(event) => setItemCategory(event.target.value)}
                placeholder="Polyester Yarn"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="unit">
                Unit of Measure
              </label>
              <select
                id="unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value as UnitOfMeasure)}
                className={inputCls}
              >
                {(lookups?.units ?? (Object.keys(UNIT_LABELS) as UnitOfMeasure[])).map((value) => (
                  <option key={value} value={value}>
                    {UNIT_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="hsnCode">
                HSN Code
              </label>
              <input
                id="hsnCode"
                value={hsnCode}
                onChange={(event) => setHsnCode(event.target.value)}
                placeholder="54023300"
                maxLength={8}
                className={`${inputCls} font-mono ${fieldErrors.hsnCode ? errorInputCls : ''}`}
              />
              {fieldErrors.hsnCode && (
                <p className="text-[10.5px] text-rose-600 mt-0.5">{fieldErrors.hsnCode}</p>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="gstRate">
                GST Rate (%)
              </label>
              <select
                id="gstRate"
                value={gstRate}
                onChange={(event) => setGstRate(event.target.value)}
                className={`${inputCls} ${fieldErrors.gstRate ? errorInputCls : ''}`}
              >
                {(lookups?.gstRates ?? ['0', '5', '12', '18', '28']).map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </select>
              {fieldErrors.gstRate && (
                <p className="text-[10.5px] text-rose-600 mt-0.5">{fieldErrors.gstRate}</p>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="defaultSalesRate">
                Default Sales Rate
              </label>
              <input
                id="defaultSalesRate"
                type="number"
                step="0.0001"
                min="0"
                value={defaultSalesRate}
                onChange={(event) => setDefaultSalesRate(event.target.value)}
                className={`${inputCls} font-mono text-right`}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="defaultPurchaseRate">
                Default Purchase Rate
              </label>
              <input
                id="defaultPurchaseRate"
                type="number"
                step="0.0001"
                min="0"
                value={defaultPurchaseRate}
                onChange={(event) => setDefaultPurchaseRate(event.target.value)}
                className={`${inputCls} font-mono text-right`}
              />
            </div>
          </div>

          {yarnFields && (
            <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Yarn Attributes
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelCls} htmlFor="yarnQuality">
                    Yarn Quality
                  </label>
                  <select
                    id="yarnQuality"
                    value={yarnQualityId}
                    onChange={(event) => {
                      setYarnQualityId(event.target.value);
                      const match = (lookups?.yarnQualities ?? []).find(
                        (entry) => entry.id === event.target.value
                      );
                      if (match?.denier) setDenier(match.denier);
                    }}
                    className={inputCls}
                  >
                    <option value="">Not linked</option>
                    {(lookups?.yarnQualities ?? []).map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.qualityName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls} htmlFor="yarnGrade">
                    Yarn Grade
                  </label>
                  <select
                    id="yarnGrade"
                    value={yarnGradeId}
                    onChange={(event) => setYarnGradeId(event.target.value)}
                    className={inputCls}
                  >
                    <option value="">Not linked</option>
                    {(lookups?.yarnGrades ?? []).map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.gradeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls} htmlFor="yarnCount">
                    Yarn Count
                  </label>
                  <input
                    id="yarnCount"
                    value={yarnCount}
                    onChange={(event) => setYarnCount(event.target.value)}
                    placeholder="150/36"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="denier">
                    Denier
                  </label>
                  <input
                    id="denier"
                    value={denier}
                    onChange={(event) => setDenier(event.target.value)}
                    placeholder="150"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="lotNumber">
                    Lot Number
                  </label>
                  <input
                    id="lotNumber"
                    value={lotNumber}
                    onChange={(event) => setLotNumber(event.target.value)}
                    placeholder="LOT-001"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {fabricFields && (
            <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Fabric Attributes
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelCls} htmlFor="fabricType">
                    Fabric Type
                  </label>
                  <input
                    id="fabricType"
                    value={fabricType}
                    onChange={(event) => setFabricType(event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="fabricDesign">
                    Fabric Design
                  </label>
                  <input
                    id="fabricDesign"
                    value={fabricDesign}
                    onChange={(event) => setFabricDesign(event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="colour">
                    Colour
                  </label>
                  <input
                    id="colour"
                    value={colour}
                    onChange={(event) => setColour(event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="sizeSpecification">
                    Size / Specification
                  </label>
                  <input
                    id="sizeSpecification"
                    value={sizeSpecification}
                    onChange={(event) => setSizeSpecification(event.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-[11px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#244d47] disabled:opacity-60 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {isSubmitting ? 'Saving…' : isEditing ? 'Update Item' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  );
};