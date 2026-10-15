import { Download, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Invoice, Language, StoreSettings } from '../types';
import { downloadInvoicePDF, printInvoicePDF, type InvoicePaperSize } from '../utils/pdf';

interface InvoiceFormatActionsProps {
  invoice: Invoice;
  settings: StoreSettings;
  language: Language;
}

const paperFormats: { size: InvoicePaperSize; label: string }[] = [
  { size: 'a4', label: 'A4' },
  { size: '80mm', label: '80 mm' },
];

export function InvoiceFormatActions({ invoice, settings, language }: InvoiceFormatActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid w-full grid-cols-1 gap-3">
      {paperFormats.map(({ size, label }) => (
        <section key={size} className="rounded-xl border border-default p-3">
          <h3 className="mb-2 text-sm font-semibold text-primary">{label}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2 px-2"
              onClick={() => downloadInvoicePDF({ invoice, settings, language, paperSize: size })}
              aria-label={`${t('history.download')} ${label}`}
            >
              <Download size={16} />
              <span className="text-sm">{t('history.download')}</span>
            </button>
            <button
              type="button"
              className="btn-primary flex items-center justify-center gap-2 px-2"
              onClick={() => printInvoicePDF({ invoice, settings, language, paperSize: size })}
              aria-label={`${t('history.print')} ${label}`}
            >
              <Printer size={16} />
              <span className="text-sm">{t('history.print')}</span>
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
