import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, Trash2, ReceiptIndianRupee, User, Phone, IndianRupee, Package, LoaderCircle } from 'lucide-react';
import {
  getProducts,
  getCustomUnits,
  getProductByName,
  saveProduct,
  saveCustomUnit,
  updateProduct,
  generateInvoiceNumber,
  saveInvoice,
} from '../db';
import type { InvoiceItem, PaymentMethod, Invoice, Product } from '../types';
import { GST_SLABS, calculateGST, calculateTotal } from '../utils/gst';
import { formatCurrency } from '../utils/format';
import { convertQuantity, getCompatibleUnits, isMassUnit } from '../utils/units';
import { useApp } from '../context/AppContext';
import { Input, Select } from '../components/common/Input';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { InvoiceFormatActions } from '../components/InvoiceFormatActions';

const ADD_CUSTOM_UNIT_OPTION = '__add_custom_unit__';
const BUILT_IN_UNITS = ['pcs', 'kg', 'gm', 'ltr'];

export function BillingPage() {
  const { t } = useTranslation();
  const { settings, language } = useApp();

  // Product search / entry form state
  const [searchQuery, setSearchQuery] = useState('');
  const [productName, setProductName] = useState('');
  const [productNameKn, setProductNameKn] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [saleUnit, setSaleUnit] = useState('pcs');
  const [showCustomUnitModal, setShowCustomUnitModal] = useState(false);
  const [customUnitName, setCustomUnitName] = useState('');
  const [customUnitError, setCustomUnitError] = useState('');
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Bill items
  const [billItems, setBillItems] = useState<InvoiceItem[]>([]);

  // GST and billing options
  const [enableGst, setEnableGst] = useState(false);
  const [gstRate, setGstRate] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');

  // Price update confirmation dialog
  const [priceConfirm, setPriceConfirm] = useState<{
    oldPrice: number;
    newPrice: number;
    productName: string;
    productId: number | null;
    pendingItem: InvoiceItem;
  } | null>(null);

  // Success modal
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);
  const [billError, setBillError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load products from DB (reactive)
  const products = useLiveQuery(() => getProducts(), []);
  const customUnits = useLiveQuery(() => getCustomUnits(), []);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameKn && p.nameKn.includes(q)),
    );
  }, [products, searchQuery]);

  // Pre-fill the GST rate from settings when the page loads,
  // but always leave the toggle OFF — user must explicitly enable GST per bill.
  useEffect(() => {
    if (settings?.defaultGstRate && settings.defaultGstRate > 0) {
      setGstRate(settings.defaultGstRate);
      // intentionally NOT setting setEnableGst(true)
    }
  }, [settings]);

  // Auto-fill price when selecting existing product
  const handleSelectProduct = (product: Product) => {
    setProductName(product.name);
    setProductNameKn(product.nameKn || '');
    setPrice(String(product.price));
    setUnit(product.unit || 'pcs');
    setSaleUnit(product.unit || 'pcs');
    setEditingProductId(product.id || null);
    setIsNewProduct(false);
    setSearchQuery(product.name);
  };

  // Start new product entry
  const handleNewProduct = () => {
    setProductName(searchQuery);
    setProductNameKn('');
    setPrice('');
    setQuantity('1');
    setUnit('pcs');
    setSaleUnit('pcs');
    setEditingProductId(null);
    setIsNewProduct(true);
  };

  const handleUnitChange = (value: string) => {
    if (value === ADD_CUSTOM_UNIT_OPTION) {
      setCustomUnitName('');
      setCustomUnitError('');
      setShowCustomUnitModal(true);
      return;
    }
    if (editingProductId !== null && !isNewProduct) {
      setSaleUnit(value);
    } else {
      setUnit(value);
      setSaleUnit(value);
    }
  };

  const handleSaveCustomUnit = async () => {
    const name = customUnitName.trim();
    if (!name) {
      setCustomUnitError(t('billing.unitRequired'));
      return;
    }

    const normalizedName = name.toLocaleLowerCase();
    const alreadyExists =
      BUILT_IN_UNITS.includes(normalizedName) ||
      customUnits?.some((customUnit) => customUnit.name.toLocaleLowerCase() === normalizedName);
    if (alreadyExists) {
      setCustomUnitError(t('billing.unitAlreadyExists'));
      return;
    }

    try {
      const savedUnit = await saveCustomUnit(name);
      setUnit(savedUnit.name);
      setSaleUnit(savedUnit.name);
      setShowCustomUnitModal(false);
      setCustomUnitName('');
      setCustomUnitError('');
    } catch {
      setCustomUnitError(t('billing.unitSaveFailed'));
    }
  };

  // Add product to bill (with price check)
  const handleAddToBill = async () => {
    if (!productName.trim() || !price || !quantity) return;

    const numPrice = parseFloat(price);
    const numQty = parseFloat(quantity);
    if (isNaN(numPrice) || numPrice <= 0 || isNaN(numQty) || numQty <= 0) return;

    const existingProduct = editingProductId
      ? products?.find((p) => p.id === editingProductId)
      : await getProductByName(productName.trim());
    const productUnit = existingProduct?.unit || unit;
    const quantityUnit = editingProductId !== null && !isNewProduct ? saleUnit : unit;
    const stockQuantity = convertQuantity(numQty, quantityUnit, productUnit);
    const saleUnitFactor = convertQuantity(1, productUnit, quantityUnit);
    if (stockQuantity === null || saleUnitFactor === null || saleUnitFactor <= 0) {
      setBillError(t('billing.unitConversionFailed'));
      return;
    }

    const saleUnitPrice = numPrice / saleUnitFactor;
    const itemTotal = Math.round(numPrice * stockQuantity * 100) / 100;
    const pendingItem: InvoiceItem = {
      name: productName.trim(),
      nameKn: productNameKn.trim() || undefined,
      price: saleUnitPrice,
      quantity: numQty,
      unit: quantityUnit,
      stockQuantity,
      stockUnit: productUnit,
      total: itemTotal,
    };

    if (existingProduct && existingProduct.id) {
      if (existingProduct.price !== numPrice) {
        // Price changed - show confirmation
        setPriceConfirm({
          oldPrice: existingProduct.price,
          newPrice: numPrice,
          productName: existingProduct.name,
          productId: existingProduct.id,
          pendingItem,
        });
        return;
      }
      // Price same - just add to bill
      addItemToBill(pendingItem, existingProduct.id);
    } else {
      // New product - save to DB then add to bill
      const saved = await saveProduct({
        name: productName.trim(),
        nameKn: productNameKn.trim() || undefined,
        price: numPrice,
        quantity: stockQuantity,
        unit: productUnit,
      });
      addItemToBill(pendingItem, saved.id!);
    }

    resetProductForm();
  };

  // Keep stock untouched while a draft bill is being edited. Stock is checked and
  // decremented atomically with invoice creation on the server.
  const addItemToBill = (item: InvoiceItem, productId: number) => {
    const billItem = { ...item, productId };
    // Merge only lines that use the same selling unit and per-unit price.
    setBillItems((prev) => {
      const existing = prev.findIndex(
        (i) => i.productId === productId && i.unit === item.unit && i.price === item.price,
      );
      if (existing >= 0) {
        const updated = [...prev];
        const mergedStockQuantity = (updated[existing].stockQuantity ?? updated[existing].quantity)
          + (item.stockQuantity ?? item.quantity);
        updated[existing].quantity += item.quantity;
        updated[existing].stockQuantity = mergedStockQuantity;
        updated[existing].total = Math.round((updated[existing].total + item.total) * 100) / 100;
        return updated;
      }
      return [...prev, billItem];
    });
    setBillError('');
  };

  // Confirm price update
  const handleConfirmPriceUpdate = async () => {
    if (!priceConfirm) return;

    // Update product in DB with new price
    if (priceConfirm.productId) {
      await updateProduct(priceConfirm.productId, { price: priceConfirm.newPrice });
    }

    // Add to bill
    addItemToBill(priceConfirm.pendingItem, priceConfirm.productId!);
    setPriceConfirm(null);
    resetProductForm();
  };

  // Remove item from bill
  const removeItem = (index: number) => {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Reset product form
  const resetProductForm = () => {
    setProductName('');
    setProductNameKn('');
    setPrice('');
    setQuantity('1');
    setUnit('pcs');
    setSaleUnit('pcs');
    setIsNewProduct(false);
    setEditingProductId(null);
    setSearchQuery('');
  };

  // Calculate totals
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const gstAmount = enableGst ? calculateGST(subtotal, gstRate) : 0;
  const total = enableGst ? calculateTotal(subtotal, gstRate) : subtotal;

  const hasUnitOption =
    BUILT_IN_UNITS.includes(unit) || customUnits?.some((customUnit) => customUnit.name === unit);
  const unitLabel = (value: string) => {
    if (value === 'pcs') return t('common.pieces');
    if (value === 'kg') return t('common.kg');
    if (value === 'gm') return t('common.gm');
    if (value === 'ltr') return t('common.ltr');
    return value;
  };
  const compatibleSaleUnits = getCompatibleUnits(unit);
  const unitOptions = (
    <>
      {!hasUnitOption && unit && <option value={unit}>{unit}</option>}
      <option value="pcs">{t('common.pieces')}</option>
      <option value="kg">{t('common.kg')}</option>
      <option value="gm">{t('common.gm')}</option>
      <option value="ltr">{t('common.ltr')}</option>
      {customUnits?.map((customUnit) => (
        <option key={customUnit.id} value={customUnit.name}>{customUnit.name}</option>
      ))}
      <option value={ADD_CUSTOM_UNIT_OPTION}>+ {t('billing.addNewUnit')}</option>
    </>
  );
  const saleUnitOptions = compatibleSaleUnits.map((saleUnitOption) => (
    <option key={saleUnitOption} value={saleUnitOption}>{unitLabel(saleUnitOption)}</option>
  ));

  // Generate bill
  const handleGenerateBill = async () => {
    if (billItems.length === 0) return;
    if (!settings) return;
    setBillError('');
    setIsGenerating(true);
    try {
      const invoiceNumber = await generateInvoiceNumber();
      const invoice: Omit<Invoice, 'id'> = {
        invoiceNumber,
        date: Date.now(),
        items: billItems,
        subtotal,
        gstRate: enableGst ? gstRate : 0,
        gstAmount,
        total,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        status: 'completed',
      };

      const saved = await saveInvoice(invoice);
      setSuccessInvoice({ ...saved });

      setBillItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
          ? error.message
          : '';
      setBillError(message.toLowerCase().includes('not enough stock')
        ? 'Not enough stock for one or more products. Update the stock in Products, refresh, and try again.'
        : message || 'Could not save this bill. Refresh and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear everything
  const handleClear = () => {
    setBillItems([]);
    setBillError('');
    resetProductForm();
    setCustomerName('');
    setCustomerPhone('');
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4 pb-24 md:pb-8">
      <h2 className="text-2xl font-bold text-primary">{t('billing.title')}</h2>

      {/* Product search & entry */}
      <div className="card p-4 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
          <input
            type="text"
            placeholder={t('billing.searchProduct')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsNewProduct(false);
              setEditingProductId(null);
            }}
            className="input-field pl-10"
          />
        </div>

        {/* Product results (when searching and not in new product mode) */}
        {searchQuery.trim() && !isNewProduct && filteredProducts.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredProducts.slice(0, 10).map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary hover:opacity-80 transition-opacity"
              >
                <div className="text-left">
                  <p className="font-medium text-primary">
                    {language === 'kn' && product.nameKn ? product.nameKn : product.name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatCurrency(product.price, language)} / {product.unit || 'pcs'}
                  </p>
                </div>
                <Plus size={18} className="text-accent" />
              </button>
            ))}
          </div>
        )}

        {/* "Add new" option when no matches or new mode */}
        {(isNewProduct || (searchQuery.trim() && filteredProducts.length === 0)) && (
          <div className="space-y-3">
            {!isNewProduct && (
              <button
                onClick={handleNewProduct}
                className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-default text-accent hover:bg-accent/5 transition-colors"
              >
                <Plus size={18} />
                <span className="font-medium">
                  {t('billing.newProduct')}: "{searchQuery}"
                </span>
              </button>
            )}

            {isNewProduct && (
              <>
                {/* Product name (pre-filled from search) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t('billing.productName')}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder={t('billing.productName')}
                  />
                  <Input
                    label={t('billing.productNameKn')}
                    value={productNameKn}
                    onChange={(e) => setProductNameKn(e.target.value)}
                    placeholder={t('billing.productNameKn')}
                  />
                </div>

                {/* Price, Quantity, Unit */}
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3">
                  <Input
                    label={`${t('billing.price')} / ${unit}`}
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    icon={<IndianRupee size={16} />}
                  />
                  <Input
                    label={t('billing.quantity')}
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                    min={isMassUnit(unit) ? '0.001' : '1'}
                    step={isMassUnit(unit) ? '0.001' : '1'}
                  />
                  <Select
                    label={t('billing.unit')}
                    value={unit}
                    onChange={(e) => handleUnitChange(e.target.value)}
                  >
                    {unitOptions}
                  </Select>
                  <div className="flex items-end">
                    <button
                      className="btn-primary w-full"
                      onClick={handleAddToBill}
                      disabled={!productName.trim() || !price || !quantity}
                    >
                      {t('billing.addToBill')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Show entry form when product selected from list */}
        {editingProductId !== null && !isNewProduct && (
          <div className="space-y-3 border-t border-default pt-3">
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3">
              <Input
                label={`${t('billing.price')} / ${unit}`}
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                icon={<IndianRupee size={16} />}
              />
              <Input
                label={t('billing.quantity')}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                min={isMassUnit(saleUnit) ? '0.001' : '1'}
                step={isMassUnit(saleUnit) ? '0.001' : '1'}
              />
              <Select
                label={t('billing.unit')}
                value={saleUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
              >
                {saleUnitOptions}
              </Select>
              <div className="flex items-end">
                <button
                  className="btn-primary w-full"
                  onClick={handleAddToBill}
                  disabled={!price || !quantity}
                >
                  {t('billing.addToBill')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bill items */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <ReceiptIndianRupee size={18} />
          {t('billing.billItems')}
        </h3>

        {billItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted">
            <Package size={32} />
            <p className="text-sm">{t('billing.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {billItems.map((item, index) => (
              <div
                key={index}
                className="bill-item-enter flex items-center justify-between p-3 rounded-lg bg-secondary"
                style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary truncate">
                    {language === 'kn' && item.nameKn ? item.nameKn : item.name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatCurrency(item.price, language)} / {item.unit || 'pcs'} x {item.quantity} {item.unit || ''} = {' '}
                    <span className="font-semibold text-primary">
                      {formatCurrency(item.total, language)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="p-2 text-muted hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer info */}
      {billItems.length > 0 && (
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-primary">{t('billing.buyerDetails')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('billing.customerName')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              icon={<User size={16} />}
              placeholder={t('billing.customerName')}
            />
            <Input
              label={t('billing.customerPhone')}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              icon={<Phone size={16} />}
              placeholder="9876543210"
            />
          </div>
          <Select
            label={t('billing.paymentMethod')}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="">{t('billing.none')}</option>
            <option value="cash">{t('billing.cash')}</option>
            <option value="card">{t('billing.card')}</option>
            <option value="upi">{t('billing.upi')}</option>
            <option value="other">{t('billing.other')}</option>
          </Select>
        </div>
      )}

      {/* Summary & actions */}
      {billItems.length > 0 && (
        <div className="card p-4 space-y-4">
          {/* GST toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-secondary">{t('billing.addGst')}</span>
            <button
              onClick={() => setEnableGst(!enableGst)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                enableGst ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  enableGst ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* GST rate selector */}
          {enableGst && (
            <div className="flex gap-2 flex-wrap">
              {GST_SLABS.filter((s) => s > 0).map((rate) => (
                <button
                  key={rate}
                  onClick={() => setGstRate(rate)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    gstRate === rate
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-secondary'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="space-y-2 border-t border-default pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">{t('billing.subtotal')}</span>
              <span className="text-primary font-medium">{formatCurrency(subtotal, language)}</span>
            </div>
            {enableGst && gstRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('billing.gstRate')} ({gstRate}%)</span>
                <span className="text-primary font-medium">{formatCurrency(gstAmount, language)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-default">
              <span className="text-primary">{t('billing.total')}</span>
              <span className="text-accent">{formatCurrency(total, language)}</span>
            </div>
          </div>

          {/* Action buttons */}
          {billError && <p role="alert" className="text-sm text-red-500">{billError}</p>}
          <div className="flex flex-col gap-3 min-[400px]:flex-row">
            <button className="btn-secondary w-full min-[400px]:flex-1" onClick={handleClear}>
              {t('billing.clearBill')}
            </button>
            <button className="btn-primary inline-flex w-full items-center justify-center gap-2 min-[400px]:flex-1" onClick={handleGenerateBill} disabled={isGenerating} aria-busy={isGenerating}>
              {isGenerating && <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />}
              {t('billing.generateBill')}
            </button>
          </div>
        </div>
      )}

      {/* Price update confirmation */}
      <ConfirmDialog
        isOpen={!!priceConfirm}
        onClose={() => setPriceConfirm(null)}
        onConfirm={handleConfirmPriceUpdate}
        title={t('billing.priceUpdateTitle')}
        message={
          priceConfirm
            ? priceConfirm.newPrice < priceConfirm.oldPrice
              ? t('billing.priceLower', {
                  newPrice: formatCurrency(priceConfirm.newPrice, language),
                  oldPrice: formatCurrency(priceConfirm.oldPrice, language),
                })
              : t('billing.priceHigher', {
                  newPrice: formatCurrency(priceConfirm.newPrice, language),
                  oldPrice: formatCurrency(priceConfirm.oldPrice, language),
                })
            : ''
        }
        confirmLabel={t('billing.confirm')}
        cancelLabel={t('billing.cancel')}
      />

      {/* Create and save a reusable product unit */}
      <Modal
        isOpen={showCustomUnitModal}
        onClose={() => setShowCustomUnitModal(false)}
        title={t('billing.addNewUnit')}
      >
        <div className="space-y-4">
          <Input
            label={t('billing.unitName')}
            value={customUnitName}
            onChange={(event) => {
              setCustomUnitName(event.target.value);
              setCustomUnitError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSaveCustomUnit();
              }
            }}
            placeholder={t('billing.unitNamePlaceholder')}
            maxLength={24}
            autoFocus
          />
          {customUnitError && <p className="text-sm text-red-500">{customUnitError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setShowCustomUnitModal(false)}
            >
              {t('billing.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => void handleSaveCustomUnit()}
              disabled={!customUnitName.trim()}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal
        isOpen={!!successInvoice}
        onClose={() => setSuccessInvoice(null)}
        title={t('billing.billGenerated')}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-accent2/10 flex items-center justify-center">
            <ReceiptIndianRupee size={32} className="text-accent2" />
          </div>
          <div>
            <p className="text-sm text-secondary">{t('receipt.invoiceNo')}</p>
            <p className="text-2xl font-bold text-primary">{successInvoice?.invoiceNumber}</p>
            <p className="text-lg font-semibold text-accent mt-2">
              {successInvoice && formatCurrency(successInvoice.total, language)}
            </p>
          </div>
          {successInvoice && settings && (
            <InvoiceFormatActions invoice={successInvoice} settings={settings} language={language} />
          )}
          <div className="w-full mt-1">
            <button className="btn-secondary w-full" onClick={() => setSuccessInvoice(null)}>
              {t('common.ok')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
