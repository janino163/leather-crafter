import { shelfPack } from './layout';
import { Pattern } from './pattern';
import { STYLE, pieceLabel, pieceOps } from './render';
import { Unit } from './units';

const rgb = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Render a pattern as a standalone SVG at true scale (width/height in mm).
 * Used both for the on-screen preview and the "Export SVG" button.
 */
export function patternToSvg(pattern: Pattern, unit: Unit, opts: { maxWidth?: number; gap?: number; grid?: boolean } = {}): string {
  const gap = opts.gap ?? 10;
  const pad = 5;
  const { placements, width, height } = shelfPack(pattern.pieces, opts.maxWidth ?? 420, gap);
  const W = width + 2 * pad;
  const H = height + 2 * pad;

  const parts: string[] = [];
  if (opts.grid) {
    parts.push(
      `<defs><pattern id="grid10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="rgb(225,225,225)" stroke-width="0.2"/></pattern></defs>`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#grid10)"/>`,
    );
  }
  for (const { piece, x, y } of placements) {
    const ox = x + pad;
    const oy = y + pad;
    parts.push(`<g transform="translate(${ox.toFixed(3)} ${oy.toFixed(3)})" data-piece="${esc(piece.id)}">`);
    for (const op of pieceOps(piece)) {
      if (op.kind === 'hole') {
        parts.push(`<path d="${op.d}" fill="${rgb(STYLE.hole.color)}" stroke="none"/>`);
      } else {
        const st = STYLE[op.kind];
        const dash = st.dash.length ? ` stroke-dasharray="${st.dash.join(' ')}"` : '';
        const fill = op.kind === 'cut' ? 'rgba(196,150,100,0.12)' : 'none';
        parts.push(`<path d="${op.d}" fill="${fill}" fill-rule="evenodd" stroke="${rgb(st.color)}" stroke-width="${st.width}"${dash} stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
    const { lines, size } = pieceLabel(piece, unit);
    const lh = size * 1.3;
    const y0 = piece.height / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((t, i) => {
      parts.push(
        `<text x="${(piece.width / 2).toFixed(2)}" y="${(y0 + i * lh).toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-size="${(i === 0 ? size : size * 0.8).toFixed(2)}" font-weight="${i === 0 ? 700 : 400}" fill="${rgb(STYLE.label.color)}" text-anchor="middle" dominant-baseline="middle">${esc(t)}</text>`,
      );
    });
    parts.push('</g>');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}mm" height="${H.toFixed(2)}mm" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">${parts.join('')}</svg>`;
}
