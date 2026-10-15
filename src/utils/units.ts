const MASS_UNITS_IN_GRAMS: Record<string, number> = {
  kg: 1000,
  gm: 1,
  g: 1,
  gram: 1,
  grams: 1,
};

function normalizeUnit(unit: string): string {
  return unit.trim().toLocaleLowerCase();
}

export function isMassUnit(unit: string): boolean {
  return Object.prototype.hasOwnProperty.call(MASS_UNITS_IN_GRAMS, normalizeUnit(unit));
}

/** Returns how many target units equal one source unit, or null if unrelated. */
export function getUnitConversionFactor(sourceUnit: string, targetUnit: string): number | null {
  const source = normalizeUnit(sourceUnit);
  const target = normalizeUnit(targetUnit);
  if (!source || !target) return null;
  if (source === target) return 1;

  const sourceInGrams = MASS_UNITS_IN_GRAMS[source];
  const targetInGrams = MASS_UNITS_IN_GRAMS[target];
  if (sourceInGrams === undefined || targetInGrams === undefined) return null;
  return sourceInGrams / targetInGrams;
}

export function convertQuantity(quantity: number, sourceUnit: string, targetUnit: string): number | null {
  const factor = getUnitConversionFactor(sourceUnit, targetUnit);
  return factor === null ? null : quantity * factor;
}

/** Units that can safely be used to sell a product stocked in `stockUnit`. */
export function getCompatibleUnits(stockUnit: string): string[] {
  const unit = stockUnit.trim();
  const normalized = normalizeUnit(unit);
  if (normalized === 'kg') return [unit, 'gm'];
  if (['gm', 'g', 'gram', 'grams'].includes(normalized)) return [unit, 'kg'];
  return [unit];
}
