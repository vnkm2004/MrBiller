import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, IndianRupee, Package, Pencil, Plus, Search, Tag } from 'lucide-react';
import { getCustomUnits, getProducts, saveProduct, updateProduct } from '../db';
import { Input, Select } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { isMassUnit } from '../utils/units';

type ProductDraft = {
  name: string;
  nameKn: string;
  category: string;
  price: string;
  quantity: string;
  unit: string;
};

const emptyDraft = (): ProductDraft => ({
  name: '',
  nameKn: '',
  category: '',
  price: '',
  quantity: '0',
  unit: 'pcs',
});

export function InventoryPage() {
  const { t } = useTranslation();
  const { language } = useApp();
  const productQuery = useLiveQuery(() => getProducts(), []);
  const customUnits = useLiveQuery(() => getCustomUnits(), []) || [];
  const products = productQuery || [];
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'out'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const outOfStockCount = products.filter((product) => product.quantity <= 0).length;
  const inStockCount = products.length - outOfStockCount;
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      if (stockFilter === 'out' && product.quantity > 0) return false;
      if (!query) return true;
      return [product.name, product.nameKn, product.category]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [products, search, stockFilter]);

  const setField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveError('');
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setSaveError('');
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    if (product.id === undefined) return;
    setEditingId(product.id);
    setDraft({
      name: product.name,
      nameKn: product.nameKn || '',
      category: product.category || '',
      price: String(product.price),
      quantity: String(product.quantity),
      unit: product.unit || 'pcs',
    });
    setSaveError('');
    setNotice('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setSaveError('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const name = draft.name.trim();
    const price = Number(draft.price);
    const quantity = Number(draft.quantity);
    if (!name) {
      setSaveError(t('inventory.itemName') + ' is required.');
      return;
    }
    if (products.some((product) => product.id !== editingId && product.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setSaveError(t('inventory.duplicateName'));
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setSaveError(t('inventory.invalidPrice'));
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      setSaveError(t('inventory.invalidQuantity'));
      return;
    }
    if (draft.unit === 'pcs' && !Number.isInteger(quantity)) {
      setSaveError(t('inventory.wholePieces'));
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      const updates = {
        name,
        nameKn: draft.nameKn.trim() || undefined,
        category: draft.category.trim() || undefined,
        price,
        quantity,
        unit: draft.unit,
      };
      if (editingId !== null) await updateProduct(editingId, updates);
      else await saveProduct(updates);
      setDialogOpen(false);
      setNotice(t('inventory.saved'));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('inventory.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const units = [...new Set(['pcs', 'kg', 'gm', 'ltr', ...customUnits.map((item) => item.name)])];
  const pieceStep = draft.unit === 'pcs' ? '1' : isMassUnit(draft.unit) ? '0.001' : '0.01';

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Package size={24} /></span>
          <div>
            <h2 className="text-2xl font-bold text-primary">{t('inventory.title')}</h2>
            <p className="mt-1 text-sm text-muted">{t('inventory.description')}</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 self-stretch sm:self-auto">
          <Plus size={18} /> {t('inventory.addItem')}
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Package size={18} />} label={t('inventory.items')} value={products.length} />
        <SummaryCard icon={<CheckCircle2 size={18} />} label={t('inventory.inStock')} value={inStockCount} tone="green" />
        <SummaryCard icon={<AlertTriangle size={18} />} label={t('inventory.outOfStock')} value={outOfStockCount} tone="amber" />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-default p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="input-field pl-10" placeholder={t('inventory.search')} aria-label={t('inventory.search')} />
          </div>
          <div className="flex shrink-0 gap-2" role="group" aria-label={t('inventory.title')}>
            <button type="button" onClick={() => setStockFilter('all')} className={`rounded-xl px-3 py-2 text-sm font-medium transition ${stockFilter === 'all' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary hover:opacity-80'}`}>{t('inventory.allItems')}</button>
            <button type="button" onClick={() => setStockFilter('out')} className={`rounded-xl px-3 py-2 text-sm font-medium transition ${stockFilter === 'out' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary hover:opacity-80'}`}>{t('inventory.outOfStock')} <span className="ml-1 opacity-75">{outOfStockCount}</span></button>
          </div>
        </div>

        {notice && <p role="status" className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {productQuery === undefined ? (
          <p className="p-8 text-center text-sm text-muted">{t('common.loading')}</p>
        ) : filteredProducts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Package size={26} /></span>
            <p className="mt-4 font-semibold text-primary">{products.length === 0 ? t('inventory.noItems') : t('inventory.noMatches')}</p>
            {products.length === 0 && <button type="button" onClick={openCreate} className="btn-primary mt-5 inline-flex items-center gap-2"><Plus size={17} /> {t('inventory.addItem')}</button>}
          </div>
        ) : (
          <ul className="divide-y divide-default">
            {filteredProducts.map((product) => {
              const displayName = language === 'kn' && product.nameKn ? product.nameKn : product.name;
              const isOut = product.quantity <= 0;
              return (
                <li key={product.id ?? product.name} className="flex flex-col gap-3 p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary"><Tag size={18} /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-primary">{displayName}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${isOut ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{isOut ? t('inventory.outOfStock') : t('inventory.inStock')}</span>
                      </div>
                      {language !== 'kn' && product.nameKn && <p className="mt-0.5 text-xs text-muted">{product.nameKn}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        {product.category && <span>{product.category}</span>}
                        <span>{t('inventory.availableQuantity')}: <strong className="font-medium text-secondary">{new Intl.NumberFormat(language === 'kn' ? 'kn-IN' : 'en-IN', { maximumFractionDigits: 3 }).format(product.quantity)} {product.unit || 'pcs'}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:justify-end sm:pl-0">
                    <p className="font-semibold text-primary">{formatCurrency(product.price, language)} <span className="text-xs font-normal text-muted">/ {product.unit || 'pcs'}</span></p>
                    <button type="button" onClick={() => openEdit(product)} className="btn-secondary inline-flex min-h-10 items-center gap-2 px-3 text-sm" aria-label={`${t('common.edit')} ${product.name}`}><Pencil size={15} /> {t('common.edit')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-accent" />{t('inventory.appearsInBilling')}</p>

      <Modal isOpen={dialogOpen} onClose={closeDialog} title={editingId === null ? t('inventory.addItem') : t('inventory.editItem')} maxWidth="max-w-2xl">
        <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('inventory.itemName')} value={draft.name} onChange={(event) => setField('name', event.target.value)} maxLength={120} required autoFocus />
            <Input label={t('inventory.kannadaName')} value={draft.nameKn} onChange={(event) => setField('nameKn', event.target.value)} maxLength={120} />
            <Input label={t('inventory.category')} value={draft.category} onChange={(event) => setField('category', event.target.value)} maxLength={80} />
            <Input label={`${t('inventory.price')} / ${draft.unit}`} type="number" min="0.01" step="0.01" value={draft.price} onChange={(event) => setField('price', event.target.value)} icon={<IndianRupee size={16} />} required />
            <Select label={t('billing.unit')} value={draft.unit} onChange={(event) => setField('unit', event.target.value)}>
              {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </Select>
            <Input label={t('inventory.availableQuantity')} type="number" min="0" step={pieceStep} value={draft.quantity} onChange={(event) => setField('quantity', event.target.value)} required />
          </div>
          {saveError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          <div className="flex flex-col-reverse gap-3 border-t border-default pt-4 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={closeDialog} disabled={saving}>{t('billing.cancel')}</button>
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2" disabled={saving}>{saving ? t('inventory.saving') : <><CheckCircle2 size={16} /> {t('inventory.saveItem')}</>}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone = 'orange' }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'orange' | 'green' | 'amber';
}) {
  const colors = {
    orange: 'bg-accent/10 text-accent',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</span>
      <div><p className="text-sm text-muted">{label}</p><p className="mt-0.5 text-xl font-bold text-primary">{value}</p></div>
    </div>
  );
}
