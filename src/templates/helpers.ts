import { Path, Pt, Seg, arc, line, pt } from '../core/geometry';
import { actualSpacings } from '../core/stitching';

/**
 * Open "U" stitch path (sides + bottom), as used where the top edge stays open (pockets, card slots).
 * Runs down the right side, around the bottom, and up the left side to y = topY.
 */
export function uStitchPath(x: number, w: number, topY: number, bottomY: number, rBL: number, rBR: number): Path {
  const H = Math.PI / 2;
  const segs: Seg[] = [];
  const right = x + w;
  segs.push(line(pt(right, topY), pt(right, bottomY - rBR)));
  if (rBR > 0) segs.push(arc(pt(right - rBR, bottomY - rBR), rBR, 0, H));
  segs.push(line(pt(right - rBR, bottomY), pt(x + rBL, bottomY)));
  if (rBL > 0) segs.push(arc(pt(x + rBL, bottomY - rBL), rBL, H, 2 * H));
  segs.push(line(pt(x, bottomY - rBL), pt(x, topY)));
  return { segs, closed: false };
}

/** Holes inside a rectangle, re-expressed in a sub-piece's local coordinates (offset by its origin). */
export function holesIn(holes: Pt[], region: { x0: number; y0: number; x1: number; y1: number }, origin: Pt = { x: 0, y: 0 }): Pt[] {
  const e = 1e-6;
  return holes
    .filter((h) => h.x >= region.x0 - e && h.x <= region.x1 + e && h.y >= region.y0 - e && h.y <= region.y1 + e)
    .map((h) => ({ x: h.x - origin.x, y: h.y - origin.y }));
}

/** Human-readable range of the evenly-distributed stitch spacings, e.g. "3.82–3.88 mm". */
export function spacingSummary(paths: Path[], spacing: number): string {
  const all = paths.flatMap((p) => actualSpacings(p, spacing));
  if (!all.length) return '—';
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return Math.abs(hi - lo) < 0.005 ? `${lo.toFixed(2)} mm` : `${lo.toFixed(2)}–${hi.toFixed(2)} mm`;
}
