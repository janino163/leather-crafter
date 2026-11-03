// All geometry is computed in millimetres. Units only matter at the UI / label boundary.

export type Unit = 'mm' | 'in';

export const MM_PER_IN = 25.4;
/** Leather weight: 1 oz ≈ 1/64 inch ≈ 0.397 mm. */
export const MM_PER_OZ = MM_PER_IN / 64;
/** PDF points per millimetre (72 pt per inch). */
export const PT_PER_MM = 72 / MM_PER_IN;

export const ozToMm = (oz: number) => oz * MM_PER_OZ;
export const mmToOz = (mm: number) => mm / MM_PER_OZ;

export const toDisplay = (mm: number, unit: Unit) => (unit === 'mm' ? mm : mm / MM_PER_IN);
export const fromDisplay = (value: number, unit: Unit) => (unit === 'mm' ? value : value * MM_PER_IN);

/** Format a length for labels, e.g. "98.4 mm" or "3.875 in". */
export function formatLength(mm: number, unit: Unit, withUnit = true): string {
  const v = toDisplay(mm, unit);
  const s = unit === 'mm' ? trimZeros(v.toFixed(1)) : trimZeros(v.toFixed(3));
  return withUnit ? `${s} ${unit}` : s;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}
