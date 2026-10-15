import Dexie, { type Table } from 'dexie';
import type { Product, Invoice, StoreSettings, CustomUnit } from '../types';
import { DEFAULT_ACCENT_COLOR } from '../utils/theme';
import { requireSupabase } from '../lib/supabase';

// IndexedDB provides the current shop's reactive local cache for the UI.
export class BillerDB extends Dexie {
  products!: Table<Product, number>;
  invoices!: Table<Invoice, number>;
  settings!: Table<StoreSettings, number>;
  customUnits!: Table<CustomUnit, number>;
  legacyProducts!: Table<Product, number>;
  legacyInvoices!: Table<Invoice, number>;
  legacySettings!: Table<StoreSettings, number>;
  legacyCustomUnits!: Table<CustomUnit, number>;

  constructor() {
    super('BillerDB');
    this.version(1).stores({
      products: '++id, name, category, createdAt',
      invoices: '++id, invoiceNumber, date, status, createdAt',
      settings: '++id',
    });
    // v2 adds the auth table — Dexie migrates automatically
    this.version(2).stores({
      products: '++id, name, category, createdAt',
      invoices: '++id, invoiceNumber, date, status, createdAt',
      settings: '++id',
      auth: '++id',
    });
    // v3 adds reusable custom product units.
    this.version(3).stores({
      products: '++id, name, category, createdAt',
      invoices: '++id, invoiceNumber, date, status, createdAt',
      settings: '++id',
      auth: '++id',
      customUnits: '++id, &name, createdAt',
    });
    // Supabase sessions replace local PIN auth. Keep the old data stores long enough
    // to archive existing shop data before clearing the active local cache.
    this.version(4).stores({
      products: '++id, name, category, createdAt',
      invoices: '++id, invoiceNumber, date, status, createdAt',
      settings: '++id',
      customUnits: '++id, &name, createdAt',
    });
    this.version(5).stores({
      products: '++id, name, category, createdAt',
      invoices: '++id, invoiceNumber, date, status, createdAt',
      settings: '++id',
      customUnits: '++id, &name, createdAt',
      legacyProducts: '++id, name, category, createdAt',
      legacyInvoices: '++id, invoiceNumber, date, status',
      legacySettings: '++id',
      legacyCustomUnits: '++id, &name, createdAt',
    });
  }
}

export const db = new BillerDB();

let activeShopId: string | null = null;

export function setActiveShopId(shopId: string | null) {
  activeShopId = shopId;
}

function requireActiveShopId() {
  if (!activeShopId) throw new Error('Sign in to a shop before accessing billing data.');
  return activeShopId;
}

type ProductRow = {
  id: number | string;
  name: string;
  name_kn: string | null;
  price: number | string;
  quantity: number | string;
  unit: string | null;
  category: string | null;
  created_at: number | string;
  updated_at: number | string;
};

type InvoiceRow = {
  id: number | string;
  invoice_number: string;
  date_ms: number | string;
  items: Invoice['items'];
  subtotal: number | string;
  gst_rate: number | string;
  gst_amount: number | string;
  total: number | string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: Invoice['paymentMethod'];
  status: Invoice['status'];
};

type CustomUnitRow = { id: number | string; name: string; created_at: number | string };

function mapProduct(row: ProductRow): Product {
  return {
    id: Number(row.id),
    name: row.name,
    nameKn: row.name_kn || undefined,
    price: Number(row.price),
    quantity: Number(row.quantity),
    unit: row.unit || 'pcs',
    category: row.category || undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: Number(row.id),
    invoiceNumber: row.invoice_number,
    date: Number(row.date_ms),
    items: row.items,
    subtotal: Number(row.subtotal),
    gstRate: Number(row.gst_rate),
    gstAmount: Number(row.gst_amount),
    total: Number(row.total),
    customerName: row.customer_name || undefined,
    customerPhone: row.customer_phone || undefined,
    paymentMethod: row.payment_method,
    status: row.status,
  };
}

function mapCustomUnit(row: CustomUnitRow): CustomUnit {
  return { id: Number(row.id), name: row.name, createdAt: Number(row.created_at) };
}

export async function clearLocalShopCache(): Promise<void> {
  setActiveShopId(null);
  await db.transaction('rw', [db.products, db.invoices, db.settings, db.customUnits], async () => {
    await Promise.all([
      db.products.clear(),
      db.invoices.clear(),
      db.settings.clear(),
      db.customUnits.clear(),
    ]);
  });
}

const LEGACY_ARCHIVE_KEY = 'biller_legacy_local_data_archived_v1';

export async function archiveLegacyLocalData(): Promise<void> {
  if (localStorage.getItem(LEGACY_ARCHIVE_KEY) === 'yes') return;
  const [products, invoices, settings, customUnits, archivedProductCount, archivedInvoiceCount] = await Promise.all([
    db.products.toArray(),
    db.invoices.toArray(),
    db.settings.toArray(),
    db.customUnits.toArray(),
    db.legacyProducts.count(),
    db.legacyInvoices.count(),
  ]);
  if (archivedProductCount === 0 && archivedInvoiceCount === 0) {
    await db.transaction('rw', [db.legacyProducts, db.legacyInvoices, db.legacySettings, db.legacyCustomUnits], async () => {
      await Promise.all([
        products.length ? db.legacyProducts.bulkPut(products) : Promise.resolve(),
        invoices.length ? db.legacyInvoices.bulkPut(invoices) : Promise.resolve(),
        settings.length ? db.legacySettings.bulkPut(settings) : Promise.resolve(),
        customUnits.length ? db.legacyCustomUnits.bulkPut(customUnits) : Promise.resolve(),
      ]);
    });
  }
  localStorage.setItem(LEGACY_ARCHIVE_KEY, 'yes');
}

export async function getLegacyShopData() {
  const [products, invoices, settings, customUnits] = await Promise.all([
    db.legacyProducts.toArray(),
    db.legacyInvoices.toArray(),
    db.legacySettings.get(1),
    db.legacyCustomUnits.toArray(),
  ]);
  return { products, invoices, settings: settings || null, customUnits };
}

export async function clearLegacyShopData(): Promise<void> {
  await db.transaction('rw', [db.legacyProducts, db.legacyInvoices, db.legacySettings, db.legacyCustomUnits], async () => {
    await Promise.all([
      db.legacyProducts.clear(),
      db.legacyInvoices.clear(),
      db.legacySettings.clear(),
      db.legacyCustomUnits.clear(),
    ]);
  });
}

async function fetchAllRows(client: ReturnType<typeof requireSupabase>, table: string, shopId: string, orderBy: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('shop_id', shopId)
      .order(orderBy)
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function hydrateShopCache(shopId: string): Promise<StoreSettings> {
  setActiveShopId(shopId);
  const client = requireSupabase();
  const [productRows, invoiceRows, unitRows, settingsResult] = await Promise.all([
    fetchAllRows(client, 'products', shopId, 'name'),
    fetchAllRows(client, 'invoices', shopId, 'date_ms'),
    fetchAllRows(client, 'custom_units', shopId, 'name'),
    client.from('store_settings').select('settings').eq('shop_id', shopId).maybeSingle(),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (activeShopId !== shopId) {
    throw new Error('The shop session changed while its data was refreshing.');
  }

  let settings: StoreSettings;
  if (settingsResult.data?.settings) {
    settings = { ...DEFAULT_SETTINGS, ...settingsResult.data.settings, id: 1 };
  } else {
    settings = { ...DEFAULT_SETTINGS };
    const { error } = await client.from('store_settings').insert({ shop_id: shopId, settings });
    if (error) throw error;
  }

  await db.transaction('rw', db.products, db.invoices, db.settings, db.customUnits, async () => {
    await Promise.all([
      db.products.clear(),
      db.invoices.clear(),
      db.settings.clear(),
      db.customUnits.clear(),
    ]);
    await Promise.all([
      db.products.bulkPut(productRows.map((row) => mapProduct(row as ProductRow))),
      db.invoices.bulkPut(invoiceRows.map((row) => mapInvoice(row as InvoiceRow))),
      db.settings.put(settings),
      db.customUnits.bulkPut(unitRows.map((row) => mapCustomUnit(row as CustomUnitRow))),
    ]);
  });

  return settings;
}

// Default store settings — used on first launch
export const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  storeName: 'My Shop',
  storeNameKn: '',
  address: '',
  addressKn: '',
  phone: '',
  email: '',
  gstNumber: '',
  logo: '',
  defaultGstRate: 0,
  currency: 'INR',
  language: 'en',
  theme: 'light',
  accentColor: DEFAULT_ACCENT_COLOR,
};

// Initialize settings on first run
export async function initSettings(): Promise<StoreSettings> {
  const existing = await db.settings.get(1);
  if (existing) {
    // Add new settings fields to installs created by older app versions.
    const settings = { ...DEFAULT_SETTINGS, ...existing };
    if (!existing.accentColor) await db.settings.put(settings);
    return settings;
  }
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

// Get current settings
export async function getSettings(): Promise<StoreSettings> {
  const settings = await db.settings.get(1);
  return settings || (await initSettings());
}

// Update settings
export async function updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getSettings();
  const merged = { ...current, ...settings, id: 1 };
  const shopId = requireActiveShopId();
  const { data, error } = await requireSupabase()
    .from('store_settings')
    .upsert({ shop_id: shopId, settings: merged, updated_at: new Date().toISOString() }, { onConflict: 'shop_id' })
    .select('settings')
    .single();
  if (error) throw error;
  const saved = { ...DEFAULT_SETTINGS, ...data.settings, id: 1 } as StoreSettings;
  await db.settings.put(saved);
  return saved;
}

// Generate invoice number in SHOPCODE/YYMMDDNNNN format.
// The database reserves the per-shop daily sequence atomically.
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;

  const { data, error } = await requireSupabase().rpc('next_invoice_number', {
    p_shop_id: requireActiveShopId(),
    p_day_prefix: datePrefix,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Could not reserve an invoice number.');
  return data;
}

// Save a new invoice
export async function saveInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
  const shopId = requireActiveShopId();
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_invoice_with_stock', {
    p_shop_id: shopId,
    p_invoice_number: invoice.invoiceNumber,
    p_date_ms: invoice.date,
    p_items: invoice.items,
    p_subtotal: invoice.subtotal,
    p_gst_rate: invoice.gstRate,
    p_gst_amount: invoice.gstAmount,
    p_total: invoice.total,
    p_customer_name: invoice.customerName || null,
    p_customer_phone: invoice.customerPhone || null,
    p_payment_method: invoice.paymentMethod,
    p_status: invoice.status,
  });
  if (error) throw error;
  const saved = mapInvoice(data as InvoiceRow);
  await db.invoices.put(saved);

  const productIds = [...new Set(invoice.items.map((item) => item.productId).filter((id): id is number => id !== undefined))];
  if (productIds.length) {
    const { data: products, error: productError } = await client.from('products').select('*').in('id', productIds);
    if (productError) console.error('Invoice saved, but product cache refresh failed:', productError);
    else await db.products.bulkPut((products || []).map((row: ProductRow) => mapProduct(row)));
  }
  return saved;
}

// Get all invoices sorted by date desc
export async function getAllInvoices(): Promise<Invoice[]> {
  const invoices = await db.invoices.toArray();
  return invoices.sort((a, b) => b.date - a.date);
}

// Get invoices for a specific date range
export async function getInvoicesByDateRange(start: number, end: number): Promise<Invoice[]> {
  return db.invoices.where('date').between(start, end).toArray();
}

// Get today's invoices
export async function getTodaysInvoices(): Promise<Invoice[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  return getInvoicesByDateRange(startOfDay, endOfDay);
}

// Product CRUD operations
export async function getProducts(): Promise<Product[]> {
  return db.products.orderBy('name').toArray();
}

// Reusable custom units are stored independently from products.
export async function getCustomUnits(): Promise<CustomUnit[]> {
  return db.customUnits.orderBy('name').toArray();
}

export async function saveCustomUnit(name: string): Promise<CustomUnit> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Unit name cannot be empty');

  const existing = await db.customUnits.toArray();
  const match = existing.find((unit) => unit.name.toLowerCase() === normalizedName.toLowerCase());
  if (match) return match;

  const createdAt = Date.now();
  const { data, error } = await requireSupabase()
    .from('custom_units')
    .insert({ shop_id: requireActiveShopId(), name: normalizedName, created_at: createdAt })
    .select('*')
    .single();
  if (error) throw error;
  const saved = mapCustomUnit(data as CustomUnitRow);
  await db.customUnits.put(saved);
  return saved;
}

export async function getProductByName(name: string): Promise<Product | undefined> {
  const products = await db.products.toArray();
  return products.find(
    (p) => p.name.toLowerCase().trim() === name.toLowerCase().trim(),
  );
}

export async function saveProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const now = Date.now();
  const { data, error } = await requireSupabase()
    .from('products')
    .insert({
      shop_id: requireActiveShopId(),
      name: product.name,
      name_kn: product.nameKn || null,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit || 'pcs',
      category: product.category || null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  const saved = mapProduct(data as ProductRow);
  await db.products.put(saved);
  return saved;
}

export async function updateProduct(id: number, updates: Partial<Product>): Promise<void> {
  const remoteUpdates: Record<string, unknown> = { updated_at: Date.now() };
  if (updates.name !== undefined) remoteUpdates.name = updates.name;
  if (updates.nameKn !== undefined) remoteUpdates.name_kn = updates.nameKn || null;
  if (updates.price !== undefined) remoteUpdates.price = updates.price;
  if (updates.quantity !== undefined) remoteUpdates.quantity = updates.quantity;
  if (updates.unit !== undefined) remoteUpdates.unit = updates.unit;
  if (updates.category !== undefined) remoteUpdates.category = updates.category || null;
  const { data, error } = await requireSupabase()
    .from('products')
    .update(remoteUpdates)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Product was not found in this shop.');
  await db.products.put(mapProduct(data as ProductRow));
}

export async function deleteProduct(id: number): Promise<void> {
  const { error } = await requireSupabase().from('products').delete().eq('id', id);
  if (error) throw error;
  await db.products.delete(id);
}

