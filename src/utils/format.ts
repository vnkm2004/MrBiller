import type { Language } from '../types';

// Format currency in Indian numbering system (with lakhs/crores)
export function formatCurrency(amount: number, lang: Language = 'en'): string {
  const symbol = lang === 'kn' ? '₹' : 'Rs.';
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

// Format date as DD/MM/YYYY
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Format time as HH:MM AM/PM
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format date and time together
export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

// Get day label for charts
export function getDayLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
  });
}

// Get short date for grouping
export function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
