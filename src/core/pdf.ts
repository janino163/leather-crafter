import { PDFDocument, PDFFont, PDFPage, StandardFonts, clip, degrees, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb } from 'pdf-lib';
import { Pt } from './geometry';
import { LETTER, Page, PageSpec, paginate, tileName } from './layout';
import { Pattern } from './pattern';
import { STYLE, pieceLabel, pieceOps } from './render';
import { PT_PER_MM, Unit, formatLength } from './units';

export interface PdfMeta {
  templateName: string;
  unit: Unit;
  /** Parameter lines for the cover sheet, already formatted, e.g. ["Leather thickness", "3 oz (1.19 mm)"]. */
  params: [string, string][];
}

const K = PT_PER_MM;
const col = (c: readonly number[]) => rgb(c[0], c[1], c[2]);

/** Build the printable PDF: cover sheet (calibration, parameters, pieces, steps) + 1:1 template pages. */
export async function patternToPdf(pattern: Pattern, meta: PdfMeta, spec: PageSpec = LETTER): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${pattern.title} — Leather Crafter`);
  doc.setCreator('Leather Crafter');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(font.getCharacterSet());
  const safe = (s: string) =>
    [...s.replace(/≈/g, '~').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/–/g, '-')]
      .map((ch) => (charset.has(ch.codePointAt(0)!) ? ch : '?'))
      .join('');

  const pages = paginate(pattern.pieces, spec);
  drawCover(doc, pattern, meta, pages, spec, font, bold, safe);
  pages.forEach((pg, i) => drawTemplatePage(doc, pg, i + 1, pages.length, meta, spec, font, bold, safe));
  return doc.save();
}

// ------------------------------------------------------------------------------------------- cover

function drawCover(
  doc: PDFDocument,
  pattern: Pattern,
  meta: PdfMeta,
  pages: Page[],
  spec: PageSpec,
  font: PDFFont,
  bold: PDFFont,
  safe: (s: string) => string,
): void {
  const PW = spec.width * K;
  const PH = spec.height * K;
  const M = spec.margin * K + 8;
  let page = doc.addPage([PW, PH]);
  let y = PH - M;

  const ensure = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([PW, PH]);
      y = PH - M;
    }
  };
  const text = (s: string, size: number, f = font, x = M, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(safe(s), { x, y: y - size, size, font: f, color });
  };
  const para = (s: string, size: number, indent = 0, f = font) => {
    for (const ln of wrap(safe(s), f, size, PW - 2 * M - indent)) {
      ensure(size * 1.4);
      page.drawText(ln, { x: M + indent, y: y - size, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size * 1.4;
    }
  };
  const heading = (s: string) => {
    ensure(30);
    y -= 8;
    text(s, 12, bold);
    y -= 18;
  };

  text(pattern.title, 20, bold);
  y -= 26;
  text(`${meta.templateName} · generated ${new Date().toLocaleDateString()} · Leather Crafter`, 9, font, M, rgb(0.4, 0.4, 0.4));
  y -= 22;

  // Calibration: a 1 in square and a 25 mm square, side by side.
  const boxTop = y;
  page.drawRectangle({ x: M - 6, y: boxTop - 150, width: PW - 2 * M + 12, height: 150, color: rgb(1, 0.97, 0.88), borderColor: rgb(0.85, 0.65, 0.2), borderWidth: 1 });
  y -= 10;
  text('PRINT AT 100% / "ACTUAL SIZE" — never "Fit to page".', 11, bold, M + 4);
  y -= 16;
  text('Measure both squares before cutting. If they are not exact, fix your print settings.', 9, font, M + 4);
  const sqY = boxTop - 136;
  const in1 = 25.4 * K;
  const mm25 = 25 * K;
  page.drawRectangle({ x: M + 10, y: sqY, width: in1, height: in1, borderColor: rgb(0, 0, 0), borderWidth: 0.6 });
  page.drawText('1 in', { x: M + 10 + in1 + 6, y: sqY + in1 / 2 - 4, size: 9, font: bold });
  const sx = M + 10 + in1 + 60;
  page.drawRectangle({ x: sx, y: sqY, width: mm25, height: mm25, borderColor: rgb(0, 0, 0), borderWidth: 0.6 });
  page.drawText('25 mm', { x: sx + mm25 + 6, y: sqY + mm25 / 2 - 4, size: 9, font: bold });
  // Legend
  const lx = sx + mm25 + 70;
  const legend: [string, keyof typeof STYLE][] = [
    ['Cut line', 'cut'],
    ['Fold / crease', 'fold'],
    ['Stitch line', 'stitch'],
  ];
  legend.forEach(([name, key], i) => {
    const st = STYLE[key] as { color: readonly number[]; width: number; dash: number[] };
    const ly = sqY + in1 - 6 - i * 16;
    page.drawLine({ start: { x: lx, y: ly }, end: { x: lx + 40, y: ly }, thickness: Math.max(st.width * K, 0.6), color: col(st.color), dashArray: st.dash.map((d) => d * K) });
    page.drawText(name, { x: lx + 48, y: ly - 3, size: 9, font });
  });
  const hy = sqY + in1 - 6 - 3 * 16;
  page.drawCircle({ x: lx + 20, y: hy, size: 2, color: col(STYLE.hole.color) });
  page.drawText('Stitch hole', { x: lx + 48, y: hy - 3, size: 9, font });
  y = boxTop - 162;

  if (pattern.warnings.length) {
    heading('Warnings');
    pattern.warnings.forEach((w) => para(`! ${w}`, 9.5));
  }

  const table = (rows: [string, string][]) => {
    const colW = (PW - 2 * M) / 2;
    for (let i = 0; i < rows.length; i += 2) {
      ensure(14);
      for (let j = 0; j < 2 && i + j < rows.length; j++) {
        const [k, v] = rows[i + j];
        page.drawText(safe(k), { x: M + j * colW, y: y - 9, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(safe(v), { x: M + j * colW + 150, y: y - 9, size: 9, font: bold });
      }
      y -= 14;
    }
  };
  heading('Result');
  table(pattern.summary.map((s): [string, string] => [s.label, s.text ?? formatLength(s.mm ?? 0, meta.unit)]));
  heading('Parameters');
  table(meta.params);

  heading('Pieces');
  for (const p of pattern.pieces) {
    ensure(14);
    page.drawText(safe(p.name), { x: M, y: y - 9.5, size: 9.5, font: bold });
    page.drawText(safe(`×${p.quantity}`), { x: M + 140, y: y - 9.5, size: 9.5, font });
    page.drawText(safe(`${formatLength(p.width, meta.unit, false)} × ${formatLength(p.height, meta.unit)}`), { x: M + 175, y: y - 9.5, size: 9.5, font });
    if (p.note) page.drawText(safe(p.note), { x: M + 300, y: y - 9.5, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
  }

  heading(`Template sheets (${pages.length})`);
  pages.forEach((pg, i) => para(`Sheet ${i + 1}: ${pg.label}${joinHint(pg)}`, 9.5));

  heading('Assembly');
  pattern.assembly.forEach((s, i) => para(`${i + 1}. ${s}`, 9.5));
}

function joinHint(pg: Page): string {
  if (!pg.tile) return '';
  const { rows, cols, row, col } = pg.tile;
  const parts: string[] = [];
  if (col + 1 < cols) parts.push(`right edge joins ${tileName(row, col + 1)}`);
  if (row + 1 < rows) parts.push(`bottom edge joins ${tileName(row + 1, col)}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

// ---------------------------------------------------------------------------------- template pages

function drawTemplatePage(
  doc: PDFDocument,
  pg: Page,
  sheetNo: number,
  sheetCount: number,
  meta: PdfMeta,
  spec: PageSpec,
  font: PDFFont,
  bold: PDFFont,
  safe: (s: string) => string,
) {
  const PWmm = pg.landscape ? spec.height : spec.width;
  const PHmm = pg.landscape ? spec.width : spec.height;
  const page = doc.addPage([PWmm * K, PHmm * K]);
  const PH = PHmm * K;
  const ox = spec.margin;
  const oy = spec.margin + spec.header;

  // Header: page label + a 1-inch scale bar for a quick check.
  page.drawText(safe(`Sheet ${sheetNo} of ${sheetCount} · ${pg.label}`), { x: spec.margin * K, y: PH - spec.margin * K - 9, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) });
  const barX = (PWmm - spec.margin - 25.4) * K;
  const barY = PH - spec.margin * K - 6;
  page.drawLine({ start: { x: barX, y: barY }, end: { x: barX + 25.4 * K, y: barY }, thickness: 0.8 });
  for (const dx of [0, 25.4 * K]) page.drawLine({ start: { x: barX + dx, y: barY - 3 }, end: { x: barX + dx, y: barY + 3 }, thickness: 0.8 });
  page.drawText('1 in', { x: barX - 20, y: barY - 3, size: 7, font });

  for (const item of pg.items) {
    const map = (p: Pt): Pt => ({ x: (ox + item.x + p.x) * K, y: (oy + item.y + p.y) * K });
    if (item.clip) {
      // Restrict drawing to this tile's region of the piece.
      const c = item.clip;
      const x = (ox + item.x + c.x) * K;
      const yTop = (oy + item.y + c.y) * K;
      page.pushOperators(pushGraphicsState(), rectangle(x - 0.5, PH - yTop - c.h * K - 0.5, c.w * K + 1, c.h * K + 1), clip(), endPath());
    }
    for (const op of pieceOps(item.piece, map, K)) {
      if (op.kind === 'hole') page.drawSvgPath(op.d, { x: 0, y: PH, color: col(STYLE.hole.color) });
      else {
        const st = STYLE[op.kind];
        page.drawSvgPath(op.d, { x: 0, y: PH, borderColor: col(st.color), borderWidth: st.width * K, borderDashArray: st.dash.map((d) => d * K) });
      }
    }
    // Label centred on the piece — or, for a tile, centred on the visible part of it.
    const { lines, size } = pieceLabel(item.piece, meta.unit);
    if (pg.tile) lines[0] = `${lines[0]} (${tileName(pg.tile.row, pg.tile.col)})`;
    const lh = size * 1.3;
    const cx = item.clip ? item.clip.x + item.clip.w / 2 : item.piece.width / 2;
    const cy = item.clip ? item.clip.y + item.clip.h / 2 : item.piece.height / 2;
    const y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      const f = i === 0 ? bold : font;
      const sz = (i === 0 ? size : size * 0.8) * K;
      const s = safe(ln);
      const w = f.widthOfTextAtSize(s, sz);
      const p = map({ x: cx, y: y0 + i * lh });
      page.drawText(s, { x: p.x - w / 2, y: PH - p.y - sz * 0.35, size: sz, font: f, color: col(STYLE.label.color) });
    });
    if (item.clip) {
      page.pushOperators(popGraphicsState());
      drawTileEdges(page, pg, item.clip, (ox + item.x) * K, (oy + item.y) * K, PH, font);
    }
  }
}

/** Light boundary lines + labels on edges that join another tile. */
function drawTileEdges(page: PDFPage, pg: Page, c: { x: number; y: number; w: number; h: number }, oxPt: number, oyPt: number, PH: number, font: PDFFont) {
  if (!pg.tile) return;
  const { row, col: cl, rows, cols } = pg.tile;
  const x0 = oxPt + c.x * K;
  const x1 = x0 + c.w * K;
  const yT = PH - (oyPt + c.y * K);
  const yB = yT - c.h * K;
  const grey = rgb(0.6, 0.6, 0.6);
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }, label: string, lx: number, ly: number, rotate = 0) => {
    page.drawLine({ start: a, end: b, thickness: 0.5, color: grey, dashArray: [6, 3] });
    page.drawText(label, { x: lx, y: ly, size: 7, font, color: grey, rotate: degrees(rotate) });
  };
  const here = tileName(row, cl);
  if (cl + 1 < cols) edge({ x: x1, y: yT }, { x: x1, y: yB }, `${here} | ${tileName(row, cl + 1)} — trim one sheet on this line, align & tape`, x1 - 5, yB + 10, 90);
  if (cl > 0) edge({ x: x0, y: yT }, { x: x0, y: yB }, `${tileName(row, cl - 1)} | ${here}`, x0 + 9, yB + 10, 90);
  if (row + 1 < rows) edge({ x: x0, y: yB }, { x: x1, y: yB }, `${here} / ${tileName(row + 1, cl)} — trim & join`, x0 + 10, yB + 3);
  if (row > 0) edge({ x: x0, y: yT }, { x: x1, y: yT }, `${tileName(row - 1, cl)} / ${here}`, x0 + 10, yT - 9);
}

function wrap(s: string, f: PDFFont, size: number, maxW: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(next, size) > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
