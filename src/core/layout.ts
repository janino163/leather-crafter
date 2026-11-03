import type { Piece } from './pattern';

export interface Placement {
  piece: Piece;
  x: number;
  y: number;
}

/** Simple shelf packing: pieces left-to-right in rows no wider than maxWidth (tallest first). */
export function shelfPack(pieces: Piece[], maxWidth: number, gap: number): { placements: Placement[]; width: number; height: number } {
  const sorted = [...pieces].sort((a, b) => b.height - a.height);
  const placements: Placement[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let width = 0;
  for (const p of sorted) {
    if (x > 0 && x + p.width > maxWidth) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    placements.push({ piece: p, x, y });
    x += p.width + gap;
    rowH = Math.max(rowH, p.height);
    width = Math.max(width, x - gap);
  }
  return { placements, width, height: y + rowH };
}

// ---------------------------------------------------------------- printed pages

export interface PageSpec {
  /** Sheet size in mm (portrait). */
  width: number;
  height: number;
  /** Unprintable margin on every side, mm. */
  margin: number;
  /** Space reserved at the top of each page for its label, mm. */
  header: number;
}

export const LETTER: PageSpec = { width: 215.9, height: 279.4, margin: 10, header: 8 };

/** One region of a piece drawn on a page. `src` is the part of the piece (piece coords) shown. */
export interface PageItem {
  piece: Piece;
  /** Where the piece origin lands, in page-content coordinates (mm). */
  x: number;
  y: number;
  /** If set, only this part of the piece is drawn (tiling). */
  clip?: { x: number; y: number; w: number; h: number };
}

export interface Page {
  landscape: boolean;
  /** Size of the drawable content area (inside margin and header), mm. */
  contentW: number;
  contentH: number;
  items: PageItem[];
  label: string;
  /** For tiled pieces: grid position, used to print join instructions. */
  tile?: { piece: string; row: number; col: number; rows: number; cols: number };
}

function contentSize(spec: PageSpec, landscape: boolean) {
  const w = landscape ? spec.height : spec.width;
  const h = landscape ? spec.width : spec.height;
  return { w: w - 2 * spec.margin, h: h - 2 * spec.margin - spec.header };
}

/**
 * Distribute pieces over printable pages at 1:1. Pieces that fit on a sheet are packed together (portrait);
 * larger pieces are tiled over several sheets, in whichever orientation needs fewer sheets.
 */
export function paginate(pieces: Piece[], spec: PageSpec = LETTER, gap = 6): Page[] {
  const portrait = contentSize(spec, false);
  const landscape = contentSize(spec, true);
  const fits = (p: Piece, c: { w: number; h: number }) => p.width <= c.w && p.height <= c.h;

  const pages: Page[] = [];
  const small = pieces.filter((p) => fits(p, portrait) || fits(p, landscape));
  const large = pieces.filter((p) => !small.includes(p));

  // Pack small pieces: portrait pages, shelf by shelf. A piece that only fits landscape gets its own landscape page.
  const landscapeOnly = small.filter((p) => !fits(p, portrait));
  let remaining = small.filter((p) => fits(p, portrait)).sort((a, b) => b.height - a.height);
  while (remaining.length) {
    const page: Page = { landscape: false, contentW: portrait.w, contentH: portrait.h, items: [], label: '' };
    let x = 0;
    let y = 0;
    let rowH = 0;
    const left: Piece[] = [];
    for (const p of remaining) {
      if (x > 0 && x + p.width > portrait.w) {
        x = 0;
        y += rowH + gap;
        rowH = 0;
      }
      if (y + p.height > portrait.h || x + p.width > portrait.w) {
        left.push(p);
        continue;
      }
      page.items.push({ piece: p, x, y });
      x += p.width + gap;
      rowH = Math.max(rowH, p.height);
    }
    page.label = page.items.map((i) => i.piece.name).join(', ');
    pages.push(page);
    remaining = left;
  }
  for (const p of landscapeOnly) {
    pages.push({ landscape: true, contentW: landscape.w, contentH: landscape.h, items: [{ piece: p, x: 0, y: 0 }], label: p.name });
  }

  for (const p of large) {
    const grid = (c: { w: number; h: number }) => ({ cols: Math.ceil(p.width / c.w), rows: Math.ceil(p.height / c.h) });
    const gp = grid(portrait);
    const gl = grid(landscape);
    const useLandscape = gl.cols * gl.rows < gp.cols * gp.rows;
    const c = useLandscape ? landscape : portrait;
    const { cols, rows } = useLandscape ? gl : gp;
    // Split evenly so every tile has similar size (nicer than one full tile + a sliver).
    const tw = p.width / cols;
    const th = p.height / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        pages.push({
          landscape: useLandscape,
          contentW: c.w,
          contentH: c.h,
          items: [{ piece: p, x: -col * tw, y: -row * th, clip: { x: col * tw, y: row * th, w: tw, h: th } }],
          label: `${p.name} — part ${tileName(row, col)} of ${rows * cols}`,
          tile: { piece: p.name, row, col, rows, cols },
        });
      }
    }
  }
  return pages;
}

/** Tile names like A1, A2, B1 (row letter, column number). */
export const tileName = (row: number, col: number) => `${String.fromCharCode(65 + row)}${col + 1}`;
