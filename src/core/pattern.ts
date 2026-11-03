import { Path, Pt } from './geometry';

/** One piece of leather to cut. Coordinates are local to the piece: origin top-left, mm, y down. */
export interface Piece {
  id: string;
  name: string;
  /** How many to cut. */
  quantity: number;
  /** Extra instruction shown on the label, e.g. "mirror second copy". */
  note?: string;
  /** Bounding box of the cut outline. */
  width: number;
  height: number;
  /** Outer cut line(s), plus any interior cut-outs. */
  cut: Path[];
  /** Fold / crease lines (dashed). */
  fold: Path[];
  /** Stitch guide lines (dotted). */
  stitch: Path[];
  /** Stitch hole centres. */
  holes: Pt[];
}

export interface Pattern {
  title: string;
  pieces: Piece[];
  /** Non-fatal issues the user should know about (e.g. a pocket too shallow for a card). */
  warnings: string[];
  /** Build steps printed on the cover sheet. */
  assembly: string[];
  /** Key computed numbers shown in the UI, e.g. ["Stitch spacing (actual)", "3.85–3.91 mm"]. */
  summary: { label: string; mm?: number; text?: string }[];
}

/** Hole diameter drawn on templates (a mark to punch through, not the real slit size). */
export const HOLE_MARK_DIAMETER = 1.0;
