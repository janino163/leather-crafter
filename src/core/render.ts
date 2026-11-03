import { Pt, pathToSvgD } from './geometry';
import { HOLE_MARK_DIAMETER, Piece } from './pattern';
import { Unit, formatLength } from './units';

/** Visual styles shared by the on-screen SVG and the printed PDF (widths in mm). */
export const STYLE = {
  cut: { color: [0, 0, 0] as const, width: 0.35, dash: [] as number[] },
  fold: { color: [0.1, 0.35, 0.8] as const, width: 0.3, dash: [3, 2] },
  stitch: { color: [0.55, 0.55, 0.55] as const, width: 0.15, dash: [1, 1] },
  hole: { color: [0.75, 0.1, 0.1] as const, r: HOLE_MARK_DIAMETER / 2 },
  label: { color: [0.2, 0.2, 0.2] as const },
};

export interface DrawOp {
  kind: 'cut' | 'fold' | 'stitch' | 'hole';
  /** SVG path data, after applying the point mapping. */
  d: string;
}

/** Turn a piece into drawable paths. `map` converts piece mm coords to output coords; `k` is its scale. */
export function pieceOps(piece: Piece, map: (p: Pt) => Pt = (p) => p, k = 1): DrawOp[] {
  const ops: DrawOp[] = [];
  for (const p of piece.stitch) ops.push({ kind: 'stitch', d: pathToSvgD(p, map, k) });
  for (const p of piece.fold) ops.push({ kind: 'fold', d: pathToSvgD(p, map, k) });
  for (const p of piece.cut) ops.push({ kind: 'cut', d: pathToSvgD(p, map, k) });
  if (piece.holes.length) {
    const r = STYLE.hole.r * k;
    const f = (n: number) => +n.toFixed(3);
    const d = piece.holes
      .map((h) => {
        const c = map(h);
        return `M${f(c.x - r)} ${f(c.y)}A${f(r)} ${f(r)} 0 1 0 ${f(c.x + r)} ${f(c.y)}A${f(r)} ${f(r)} 0 1 0 ${f(c.x - r)} ${f(c.y)}Z`;
      })
      .join('');
    ops.push({ kind: 'hole', d });
  }
  return ops;
}

/** Label lines printed in the middle of a piece. */
export function pieceLabel(piece: Piece, unit: Unit): { lines: string[]; size: number } {
  const lines = [
    piece.name,
    `Cut ×${piece.quantity}`,
    `${formatLength(piece.width, unit, false)} × ${formatLength(piece.height, unit)}`,
  ];
  if (piece.note) lines.push(piece.note);
  // Font size (mm) scaled to fit modest pieces, capped for big ones.
  const size = Math.max(2, Math.min(4, piece.height / (lines.length * 3.2), piece.width / 22));
  return { lines, size };
}
