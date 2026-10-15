import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Download, Printer, Eye, ReceiptIndianRupee } from 'lucide-react';
import { db } from '../db';
import { formatCurrency, formatDate, formatTime } from '../utils/format';
import { downloadInvoicePDF, printInvoicePDF } from '../utils/pdf';
import { useApp } from '../context/AppContext';
import { Modal } from '../components/common/Modal';
import { InvoiceFormatActions } from '../components/InvoiceFormatActions';
import type { Invoice } from '../types';

export function HistoryPage() {
  const { t } = useTranslation();
  const { settings, language } = useApp();

  const invoices = useLiveQuery(() => db.invoices.orderBy('date').reverse().toArray(), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewing, setViewing] = useState<Invoice | null>(null);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    let result = invoices.filter((inv) => inv.status === 'completed');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
          (inv.customerPhone && inv.customerPhone.includes(q)),
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const start = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      result = result.filter((inv) => inv.date >= start && inv.date < end);
    }

    return result;
  }, [invoices, searchQuery, dateFilter]);

  if (invoices && invoices.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
        <h2 className="text-2xl font-bold text-primary mb-6">{t('history.title')}</h2>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted">
          <ReceiptIndianRupee size={48} />
          <p className="text-center">{t('history.noInvoices')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4 pb-24 md:pb-8">
      <h2 className="text-2xl font-bold text-primary">{t('history.title')}</h2>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} />
          <input
            type="text"
            placeholder={t('history.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input-field sm:w-48"
        />
      </div>

      {/* Invoice list */}
      <div className="space-y-2">
        {filteredInvoices.length === 0 ? (
          <div className="card p-8 text-center text-muted">{t('history.noInvoices')}</div>
        ) : (
          filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <ReceiptIndianRupee size={20} className="text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary text-sm">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted">
                    {formatDate(invoice.date)} {formatTime(invoice.date)} · {invoice.items.length} {t('history.items')}
                  </p>
                  {invoice.customerName && (
                    <p className="text-xs text-secondary truncate">{invoice.customerName}</p>
                  )}
                </div>
                <p className="shrink-0 font-bold text-accent text-sm sm:hidden">
                  {formatCurrency(invoice.total, language)}
                </p>
              </div>
              <p className="hidden font-bold text-accent text-sm sm:block">
                {formatCurrency(invoice.total, language)}
              </p>
              <div className="flex justify-end gap-1 border-t border-default pt-1 sm:ml-auto sm:border-0 sm:pt-0">
                <button
                  onClick={() => setViewing(invoice)}
                  className="p-2 rounded-lg text-secondary hover:bg-secondary transition-colors"
                  title={t('history.view')}
                  aria-label={t('history.view')}
                >
                  <Eye size={18} />
                </button>
                <button
                  onClick={() => {
                    if (settings) downloadInvoicePDF({ invoice, settings, language, paperSize: 'a4' });
                  }}
                  className="p-2 rounded-lg text-secondary hover:bg-secondary transition-colors"
                  title={`${t('history.download')} A4`}
                  aria-label={`${t('history.download')} A4`}
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => {
                    if (settings) printInvoicePDF({ invoice, settings, language, paperSize: 'a4' });
                  }}
                  className="p-2 rounded-lg text-secondary hover:bg-secondary transition-colors"
                  title={`${t('history.print')} A4`}
                  aria-label={`${t('history.print')} A4`}
                >
                  <Printer size={18} />
                </button>
                <button
                  onClick={() => {
                    if (settings) downloadInvoicePDF({ invoice, settings, language, paperSize: '80mm' });
                  }}
                  className="p-2 rounded-lg text-secondary hover:bg-secondary transition-colors"
                  title={`${t('history.download')} 80 mm PDF`}
                  aria-label={`${t('history.download')} 80 mm PDF`}
                >
                  <Download size={18} />
                  <span className="hidden md:inline text-xs font-medium">80 mm PDF</span>
                </button>
                <button
                  onClick={() => {
                    if (settings) printInvoicePDF({ invoice, settings, language, paperSize: '80mm' });
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-2 text-secondary transition-colors hover:bg-secondary"
                  title={`${t('history.print')} 80 mm`}
                  aria-label={`${t('history.print')} 80 mm`}
                >
                  <Printer size={18} />
                  <span className="hidden md:inline text-xs font-medium">80 mm</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoice detail modal */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.invoiceNumber}
        maxWidth="max-w-2xl"
      >
        {viewing && (
          <div className="space-y-4">
            {/* Date & customer */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted">{t('history.date')}</p>
                <p className="text-primary font-medium">
                  {formatDate(viewing.date)} {formatTime(viewing.date)}
                </p>
              </div>
              <div>
                <p className="text-muted">{t('billing.paymentMethod')}</p>
                <p className="text-primary font-medium">
                  {viewing.paymentMethod ? t(`billing.${viewing.paymentMethod}`) : ''}
                </p>
              </div>
              {viewing.customerName && (
                <div>
                  <p className="text-muted">{t('billing.customerName')}</p>
                  <p className="text-primary font-medium">{viewing.customerName}</p>
                </div>
              )}
              {viewing.customerPhone && (
                <div>
                  <p className="text-muted">{t('billing.customerPhone')}</p>
                  <p className="text-primary font-medium">{viewing.customerPhone}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="border-t border-default pt-3 space-y-2">
              {viewing.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div>
                    <p className="text-primary font-medium">
                      {language === 'kn' && item.nameKn ? item.nameKn : item.name}
                    </p>
                    <p className="text-muted text-xs">
                      {formatCurrency(item.price, language)}{item.unit ? ` / ${item.unit}` : ''} x {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </p>
                  </div>
                  <p className="text-primary font-medium">
                    {formatCurrency(item.total, language)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-default pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('billing.subtotal')}</span>
                <span className="text-primary">{formatCurrency(viewing.subtotal, language)}</span>
              </div>
              {viewing.gstRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">
                    {t('billing.gstRate')} ({viewing.gstRate}%)
                  </span>
                  <span className="text-primary">{formatCurrency(viewing.gstAmount, language)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-default">
                <span className="text-primary">{t('billing.total')}</span>
                <span className="text-accent">{formatCurrency(viewing.total, language)}</span>
              </div>
            </div>

            {/* Actions */}
            {settings && <InvoiceFormatActions invoice={viewing} settings={settings} language={language} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
