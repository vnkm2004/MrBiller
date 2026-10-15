import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, StoreSettings, Language } from '../types';
import { formatCurrency, formatDate, formatTime } from './format';
import { hexToRgb } from './theme';
import { t } from 'i18next';

export type InvoicePaperSize = 'a4' | '80mm';

interface PDFOptions {
  invoice: Invoice;
  settings: StoreSettings;
  language: Language;
  paperSize?: InvoicePaperSize;
}

type FittedLogo = ReturnType<jsPDF['getImageProperties']> & {
  displayWidth: number;
  displayHeight: number;
};

function englishPdfText(value: string | number | undefined): string {
  return String(value ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function englishPdfTranslation(key: string): string {
  return englishPdfText(String(t(key, { lng: 'en' })));
}

function fitLogo(
  doc: jsPDF,
  logoData: string | undefined,
  maxHeight: number,
  maxWidth: number,
): FittedLogo | undefined {
  if (!logoData) return undefined;

  try {
    const image = doc.getImageProperties(logoData);
    if (!image.width || !image.height) return undefined;

    // Fit inside the text-sized box without stretching or adding a background.
    const scale = Math.min(maxHeight / image.height, maxWidth / image.width);
    return {
      ...image,
      displayWidth: image.width * scale,
      displayHeight: image.height * scale,
    };
  } catch {
    return undefined;
  }
}

// Generate a PDF receipt/invoice
export function generateInvoicePDF(options: PDFOptions): jsPDF {
  const { invoice, settings, paperSize = 'a4' } = options;
  if (paperSize === '80mm') return generateThermalInvoicePDF(options);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const accentColor = hexToRgb(settings.accentColor);
  let y = 15;

  // --- Store logo and name side by side ---
  const storeName = englishPdfText(settings.storeName) || 'Shop';
  const nameFontSize = 18;
  doc.setFontSize(nameFontSize);
  doc.setFont('helvetica', 'bold');
  const textLineHeight = (nameFontSize * 1.15 * 25.4) / 72;
  const logo = fitLogo(doc, settings.logo, (nameFontSize * 0.82 * 25.4) / 72, 30);
  const logoGap = logo ? 4 : 0;
  const nameLines = doc.splitTextToSize(storeName, contentWidth - (logo?.displayWidth ?? 0) - logoGap) as string[];
  const nameWidth = Math.max(...nameLines.map((line) => doc.getTextWidth(line)));
  if (logo) {
    const rowHeight = Math.max(logo.displayHeight, nameLines.length * textLineHeight);
    const rowWidth = logo.displayWidth + logoGap + nameWidth;
    const rowX = (pageWidth - rowWidth) / 2;
    let logoAdded = false;
    try {
      doc.addImage(
        settings.logo!,
        logo.fileType,
        rowX,
        y + (rowHeight - logo.displayHeight) / 2,
        logo.displayWidth,
        logo.displayHeight,
      );
      logoAdded = true;
    } catch {
      // If the logo fails, keep the store name centered on its own.
    }
    if (logoAdded) {
      const baselineOffset = (nameFontSize * 0.28 * 25.4) / 72;
      const nameY = y + rowHeight / 2 - ((nameLines.length - 1) * textLineHeight) / 2 + baselineOffset;
      doc.text(nameLines, rowX + logo.displayWidth + logoGap, nameY, { align: 'left' });
    } else {
      doc.text(nameLines, pageWidth / 2, y + rowHeight / 2 + 2, { align: 'center' });
    }
    y += rowHeight + 3;
  } else {
    doc.text(nameLines, pageWidth / 2, y, { align: 'center' });
    y += nameLines.length * textLineHeight + 1;
  }

  // --- Store details below the logo and name ---
  const address = englishPdfText(settings.address);
  if (address) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(address, contentWidth);
    doc.text(addressLines, pageWidth / 2, y, { align: 'center' });
    y += addressLines.length * 4;
  }

  // --- Store phone ---
  const storePhone = englishPdfText(settings.phone);
  if (storePhone) {
    doc.setFontSize(9);
    doc.text(`${englishPdfTranslation('receipt.phone')}: ${storePhone}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // --- GST number (only printed when GST is actually applied to this invoice) ---
  const gstNumber = englishPdfText(settings.gstNumber);
  if (gstNumber && invoice.gstRate > 0) {
    doc.setFontSize(9);
    doc.text(`${englishPdfTranslation('settings.gstNumber')}: ${gstNumber}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // --- Divider line ---
  y += 2;
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- Invoice title and number ---
  const title = invoice.gstRate > 0 ? englishPdfTranslation('receipt.invoice') : englishPdfTranslation('receipt.bill');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${englishPdfTranslation('receipt.invoiceNo')}: ${englishPdfText(invoice.invoiceNumber)}`, margin, y);
  doc.text(`${formatDate(invoice.date)}`, pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.text(`${englishPdfTranslation('receipt.time')}: ${formatTime(invoice.date)}`, margin, y);
  y += 6;

  // --- Customer info ---
  const customerName = englishPdfText(invoice.customerName);
  const customerPhone = englishPdfText(invoice.customerPhone);
  if (customerName || customerPhone) {
    if (customerName) {
      doc.text(`${englishPdfTranslation('receipt.customer')}: ${customerName}`, margin, y);
      y += 5;
    }
    if (customerPhone) {
      doc.text(`${englishPdfTranslation('receipt.phone')}: ${customerPhone}`, margin, y);
      y += 5;
    }
    y += 2;
  }

  // --- Items table ---
  const tableData = invoice.items.map((item) => {
    const itemName = englishPdfText(item.name) || 'Item';
    const unit = englishPdfText(item.unit);
    return [
      itemName,
      `${formatCurrency(item.price, 'en')}${unit ? ` / ${unit}` : ''}`,
      `${item.quantity}${unit ? ` ${unit}` : ''}`,
      formatCurrency(item.total, 'en'),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[englishPdfTranslation('receipt.item'), englishPdfTranslation('receipt.price'), englishPdfTranslation('receipt.qty'), englishPdfTranslation('receipt.amount')]],
    body: tableData,
    theme: 'striped',
    headStyles: { fontSize: 8, fillColor: accentColor, textColor: getReadableTextColor(accentColor) },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 'auto', fontSize: 7.5 },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error - jspdf-autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 6;

  // --- Summary ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(englishPdfTranslation('receipt.subtotal'), pageWidth - margin - 40, y);
  doc.text(formatCurrency(invoice.subtotal, 'en'), pageWidth - margin, y, { align: 'right' });
  y += 5;

  if (invoice.gstRate > 0) {
    doc.text(`${englishPdfTranslation('receipt.gst')} (${invoice.gstRate}%)`, pageWidth - margin - 40, y);
    doc.text(formatCurrency(invoice.gstAmount, 'en'), pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  // Total line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - margin - 45, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(englishPdfTranslation('receipt.total'), pageWidth - margin - 40, y);
  doc.text(formatCurrency(invoice.total, 'en'), pageWidth - margin, y, { align: 'right' });
  y += 7;

  // Keep this line out of the bill when no payment method was selected.
  if (invoice.paymentMethod) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const paymentLabel = englishPdfTranslation(`billing.${invoice.paymentMethod}`);
    doc.text(`${englishPdfTranslation('receipt.paymentMethod')}: ${paymentLabel}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
  } else {
    y += 5;
  }

  // --- Footer ---
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(englishPdfTranslation('receipt.thankYou'), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7);
  doc.text(englishPdfTranslation('receipt.poweredBy'), pageWidth / 2, y, { align: 'center' });

  return doc;
}

function generateThermalInvoicePDF({ invoice, settings }: PDFOptions): jsPDF {
  const pageWidth = 80;
  const measureDoc = new jsPDF({ unit: 'mm', format: [pageWidth, 1000], orientation: 'portrait' });
  const contentBottom = renderThermalInvoiceContent(measureDoc, { invoice, settings });
  const pageHeight = Math.max(75, Math.ceil(contentBottom + 5));
  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, pageHeight], orientation: 'portrait' });
  renderThermalInvoiceContent(doc, { invoice, settings });
  return doc;
}

function renderThermalInvoiceContent(
  doc: jsPDF,
  { invoice, settings }: Pick<PDFOptions, 'invoice' | 'settings'>,
): number {
  const pageWidth = 80;
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;
  const accentColor = hexToRgb(settings.accentColor);
  let y = 6;

  const addWrappedText = (
    text: string,
    width = contentWidth,
    align: 'left' | 'center' = 'left',
    lineHeight = 3.5,
    x = margin,
  ) => {
    const safeText = englishPdfText(text);
    const lines = doc.splitTextToSize(safeText, width) as string[];
    const textX = align === 'center' ? pageWidth / 2 : x;
    if (lines.length > 0) doc.text(lines, textX, y, { align });
    y += lines.length * lineHeight;
  };

  const drawSeparator = (color: [number, number, number] = [190, 190, 190], gap = 2.5) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageWidth - margin, y);
    y += gap;
  };

  const storeName = englishPdfText(settings.storeName) || 'Shop';
  const nameFontSize = 14;
  doc.setFontSize(nameFontSize);
  doc.setFont('helvetica', 'bold');
  const textLineHeight = (nameFontSize * 1.15 * 25.4) / 72;
  const logo = fitLogo(doc, settings.logo, (nameFontSize * 0.82 * 25.4) / 72, 18);
  const logoGap = logo ? 2.5 : 0;
  const nameLines = doc.splitTextToSize(storeName, contentWidth - (logo?.displayWidth ?? 0) - logoGap) as string[];
  const nameWidth = Math.max(...nameLines.map((line) => doc.getTextWidth(line)));
  const rowHeight = Math.max(logo?.displayHeight ?? 0, nameLines.length * textLineHeight);
  if (logo) {
    const rowWidth = logo.displayWidth + logoGap + nameWidth;
    const rowX = (pageWidth - rowWidth) / 2;
    let logoAdded = false;
    try {
      doc.addImage(
        settings.logo!,
        logo.fileType,
        rowX,
        y + (rowHeight - logo.displayHeight) / 2,
        logo.displayWidth,
        logo.displayHeight,
      );
      logoAdded = true;
    } catch {
      // Keep the receipt readable when an uploaded logo cannot be embedded.
    }
    if (logoAdded) {
      const baselineOffset = (nameFontSize * 0.28 * 25.4) / 72;
      const nameY = y + rowHeight / 2 - ((nameLines.length - 1) * textLineHeight) / 2 + baselineOffset;
      doc.text(nameLines, rowX + logo.displayWidth + logoGap, nameY);
    } else {
      doc.text(nameLines, pageWidth / 2, y + rowHeight / 2 + 1.5, { align: 'center' });
    }
  } else {
    doc.text(nameLines, pageWidth / 2, y + 3, { align: 'center' });
  }
  y += rowHeight + 2;

  const address = englishPdfText(settings.address);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  if (address) addWrappedText(address, contentWidth, 'center', 3.3);
  const storePhone = englishPdfText(settings.phone);
  const gstNumber = englishPdfText(settings.gstNumber);
  if (storePhone) addWrappedText(`${englishPdfTranslation('receipt.phone')}: ${storePhone}`, contentWidth, 'center', 3.5);
  if (gstNumber && invoice.gstRate > 0) {
    addWrappedText(`${englishPdfTranslation('settings.gstNumber')}: ${gstNumber}`, contentWidth, 'center', 3.5);
  }

  y += 1;
  drawSeparator(accentColor, 4);

  const title = invoice.gstRate > 0 ? englishPdfTranslation('receipt.invoice') : englishPdfTranslation('receipt.bill');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  addWrappedText(title.toUpperCase(), contentWidth, 'center', 4.5);
  y += 1;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  addWrappedText(`${englishPdfTranslation('receipt.invoiceNo')}: ${englishPdfText(invoice.invoiceNumber)}`, contentWidth, 'left', 3.3);
  addWrappedText(`${formatDate(invoice.date)}  ${englishPdfTranslation('receipt.time')}: ${formatTime(invoice.date)}`, contentWidth, 'left', 3.3);

  const customerName = englishPdfText(invoice.customerName);
  const customerPhone = englishPdfText(invoice.customerPhone);
  if (customerName) addWrappedText(`${englishPdfTranslation('receipt.customer')}: ${customerName}`, contentWidth, 'left', 3.3);
  if (customerPhone) addWrappedText(`${englishPdfTranslation('receipt.phone')}: ${customerPhone}`, contentWidth, 'left', 3.3);
  y += 1;
  drawSeparator();

  for (const item of invoice.items) {
    const itemName = englishPdfText(item.name) || 'Item';
    const unit = englishPdfText(item.unit);
    const itemCostAndQuantity = `${formatCurrency(item.price, 'en')}${unit ? ` / ${unit}` : ''} x ${item.quantity}${unit ? ` ${unit}` : ''}`;
    const amount = formatCurrency(item.total, 'en');

    // Keep the item name, unit cost × quantity, and line total together.
    let amountFontSize = 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(amountFontSize);
    while (doc.getTextWidth(amount) > 22 && amountFontSize > 5.5) {
      amountFontSize -= 0.3;
      doc.setFontSize(amountFontSize);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const amountColumnWidth = Math.max(16, doc.getTextWidth(amount) + 1);
    const columnGap = 2;
    const nameMinWidth = 21;
    const detailsMaxWidth = contentWidth - amountColumnWidth - nameMinWidth - columnGap * 2;
    const detailsWidth = Math.max(18, Math.min(30, detailsMaxWidth, doc.getTextWidth(itemCostAndQuantity) + 1));
    const nameWidth = contentWidth - amountColumnWidth - detailsWidth - columnGap * 2;
    const detailsX = margin + nameWidth + columnGap;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    const itemNameLines = doc.splitTextToSize(itemName, nameWidth) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const detailsLines = doc.splitTextToSize(itemCostAndQuantity, detailsWidth) as string[];
    const rowLineCount = Math.max(itemNameLines.length, detailsLines.length);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text(itemNameLines, margin, y);
    doc.setFontSize(amountFontSize);
    doc.text(amount, pageWidth - margin, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(95, 95, 95);
    doc.text(detailsLines, detailsX, y);
    y += rowLineCount * 3.2 + 1;

    drawSeparator([225, 225, 225]);
    doc.setTextColor(0, 0, 0);
  }

  const drawTotalRow = (label: string, value: string, bold = false, fontSize = 8) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, margin, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += bold ? 5.5 : 4.5;
  };

  drawTotalRow(englishPdfTranslation('receipt.subtotal'), formatCurrency(invoice.subtotal, 'en'));
  if (invoice.gstRate > 0) {
    drawTotalRow(`${englishPdfTranslation('receipt.gst')} (${invoice.gstRate}%)`, formatCurrency(invoice.gstAmount, 'en'));
  }
  drawSeparator(accentColor, 4);
  drawTotalRow(englishPdfTranslation('receipt.total'), formatCurrency(invoice.total, 'en'), true, 10);

  if (invoice.paymentMethod) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    addWrappedText(`${englishPdfTranslation('receipt.paymentMethod')}: ${englishPdfTranslation(`billing.${invoice.paymentMethod}`)}`, contentWidth, 'center', 3.5);
  }
  y += 2;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  addWrappedText(englishPdfTranslation('receipt.thankYou'), contentWidth, 'center', 4);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  addWrappedText(englishPdfTranslation('receipt.poweredBy'), contentWidth, 'center', 3.2);

  return y;
}

function getReadableTextColor([r, g, b]: [number, number, number]): [number, number, number] {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? [255, 255, 255] : [17, 17, 17];
}

// Download the PDF
export function downloadInvoicePDF(options: PDFOptions): void {
  const paperSize = options.paperSize ?? 'a4';
  const doc = generateInvoicePDF({ ...options, paperSize });
  const paperSuffix = paperSize === '80mm' ? '-80mm' : '-A4';
  doc.save(`${options.invoice.invoiceNumber.replace(/\//g, '-')}${paperSuffix}.pdf`);
}

// Open the PDF for printing
export function printInvoicePDF(options: PDFOptions): void {
  const paperSize = options.paperSize ?? 'a4';
  const doc = generateInvoicePDF({ ...options, paperSize });
  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Fallback: download
    const paperSuffix = paperSize === '80mm' ? '-80mm' : '-A4';
    doc.save(`${options.invoice.invoiceNumber.replace(/\//g, '-')}${paperSuffix}.pdf`);
  }
}
