// GST calculation utilities for Indian billing
// GST slabs: 0%, 5%, 12%, 18%, 28%

export const GST_SLABS = [0, 3, 5, 12, 18, 28];

export function calculateGST(subtotal: number, gstRate: number): number {
  return (subtotal * gstRate) / 100;
}

export function calculateTotal(subtotal: number, gstRate: number): number {
  return subtotal + calculateGST(subtotal, gstRate);
}

export function calculateItemTotal(price: number, quantity: number): number {
  return price * quantity;
}
