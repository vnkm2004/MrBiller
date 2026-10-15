// Core domain types for the billing application

export interface Product {
  id?: number;
  name: string;
  nameKn?: string; // Kannada name (optional)
  price: number;
  quantity: number;
  unit?: string; // e.g. 'kg', 'pcs', 'ltr'
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomUnit {
  id?: number;
  name: string;
  createdAt: number;
}

export interface InvoiceItem {
  productId?: number;
  name: string;
  nameKn?: string;
  price: number; // Price per `unit` on this invoice line.
  quantity: number;
  unit?: string;
  /** Quantity converted to the product's stock unit for inventory deduction. */
  stockQuantity?: number;
  stockUnit?: string;
  total: number;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string; // SHOPCODE/YYMMDDNNNN format
  date: number; // timestamp
  items: InvoiceItem[];
  subtotal: number;
  gstRate: number; // percentage, e.g. 5, 12, 18, 28
  gstAmount: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  status: 'completed' | 'cancelled';
}

export interface StoreSettings {
  id?: number;
  storeName: string;
  storeNameKn?: string;
  address: string;
  addressKn?: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  logo?: string; // base64 data URL
  defaultGstRate: number;
  currency: string; // 'INR'
  language: 'en' | 'kn';
  theme: 'light' | 'dark';
  accentColor: string;
}

export type Theme = 'light' | 'dark';
export type Language = 'en' | 'kn';
export type Page = 'billing' | 'inventory' | 'dashboard' | 'history' | 'settings';
export type PaymentMethod = '' | 'cash' | 'card' | 'upi' | 'other';
