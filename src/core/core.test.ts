import { PDFDocument } from 'pdf-lib';
import { Pt, dist, line, pt, radii, roundedRect } from './geometry';
import { LETTER, paginate } from './layout';
import { Pattern } from './pattern';
import { patternToPdf } from './pdf';
import { stitchHoles } from './stitching';
import { patternToSvg } from './svg';
import { ozToMm } from './units';
import { cardHolder } from '../templates/cardHolder';
import { passportWallet } from '../templates/passportWallet';
import { notebookCover } from '../templates/notebookCover';
import { templates } from '../templates';
import { defaultValues } from '../templates/types';

const has = (set: Pt[], p: Pt, tol = 1e-6) => set.some((q) => dist(p, q) < tol);
const byId = (pat: Pattern, id: string) => pat.pieces.find((p) => p.id === id)!;

describe('units', () => {
  it('converts oz to mm (1 oz = 1/64 in)', () => {
    expect(ozToMm(4)).toBeCloseTo(1.5875, 4);
  });
});

describe('stitchHoles', () => {
  it('puts holes on sharp corners and spaces them evenly', () => {
    const holes = stitchHoles(roundedRect(0, 0, 40, 20, radii(0)), 4);
    for (const c of [pt(0, 0), pt(40, 0), pt(40, 20), pt(0, 20)]) expect(has(holes, c)).toBe(true);
    expect(holes.length).toBe(2 * (40 / 4) + 2 * (20 / 4));
  });

  it('adjusts spacing to fit a run exactly', () => {
    const holes = stitchHoles({ segs: [line(pt(0, 0), pt(10, 0))], closed: false }, 3.85);
    expect(holes.length).toBe(4); // 3 gaps of 3.333
    expect(holes[1].x).toBeCloseTo(10 / 3, 6);
  });

  it('keeps uniform spacing around rounded corners', () => {
    const holes = stitchHoles(roundedRect(0, 0, 50, 30, radii(5)), 3.5);
    const gaps = holes.map((h, i) => dist(h, holes[(i + 1) % holes.length]));
    // holes are evenly spaced along the arc; the straight chord across a tight curve is up to ~2-3% shorter.
    for (const g of gaps) expect(Math.abs(g - gaps[0]) / gaps[0]).toBeLessThan(0.03);
  });
});

describe('card holder', () => {
  const pat = cardHolder.generate({ ...defaultValues(cardHolder), pocketsPerSide: 2 });
  const front = byId(pat, 'front');

  it('fits a credit card with margin', () => {
    expect(front.width).toBeGreaterThan(85.6 + 2 * 4);
    expect(front.height).toBeGreaterThan(54 + 4);
  });

  it('pocket holes coincide with body holes', () => {
    for (const k of [1, 2]) {
      const pocket = byId(pat, `pocket-${k}`);
      const y0 = front.height - pocket.height;
      expect(pocket.holes.length).toBeGreaterThan(10);
      for (const h of pocket.holes) expect(has(front.holes, { x: h.x, y: h.y + y0 })).toBe(true);
    }
  });

  it('cuts two of each pocket when pockets are on both faces', () => {
    expect(byId(pat, 'pocket-1').quantity).toBe(2);
    const oneSide = cardHolder.generate({ ...defaultValues(cardHolder), pocketSides: 'front' });
    expect(byId(oneSide, 'pocket-1').quantity).toBe(1);
  });
});

describe('passport wallet', () => {
  const v = defaultValues(passportWallet);
  const pat = passportWallet.generate(v);
  const outer = byId(pat, 'outer');

  it('has no warnings with defaults', () => {
    expect(pat.warnings).toEqual([]);
  });

  it('open width = 2 halves + spine', () => {
    const half = 125 + 3 + 4;
    expect(outer.width).toBeGreaterThan(2 * half);
    expect(outer.width).toBeLessThan(2 * half + 25);
  });

  it('sleeve perimeter holes coincide with outer holes', () => {
    const left = byId(pat, 'left-sleeve');
    const right = byId(pat, 'right-sleeve');
    const leftPerimeter = left.holes.filter((h) => has(outer.holes, h));
    expect(leftPerimeter.length).toBeGreaterThan(40);
    for (const h of right.holes) expect(has(outer.holes, { x: h.x + outer.width - right.width, y: h.y })).toBe(true);
  });

  it('card slot holes coincide with left sleeve holes', () => {
    const left = byId(pat, 'left-sleeve');
    for (const id of ['slot-1', 'slot-2']) {
      const slot = byId(pat, id);
      const y0 = left.height - slot.height;
      for (const h of slot.holes) expect(has(left.holes, { x: h.x, y: h.y + y0 })).toBe(true);
    }
  });
});

describe('notebook cover', () => {
  it('A5 default has no warnings and needs tiling on Letter', () => {
    const pat = notebookCover.generate(defaultValues(notebookCover));
    expect(pat.warnings).toEqual([]);
    const pages = paginate(pat.pieces, LETTER);
    expect(pages.some((p) => p.tile)).toBe(true);
  });
});

describe('pagination', () => {
  it('places every piece and tiles fully cover large pieces', () => {
    for (const t of templates) {
      const pat = t.generate(defaultValues(t));
      const pages = paginate(pat.pieces, LETTER);
      for (const piece of pat.pieces) {
        const items = pages.flatMap((p) => p.items.filter((i) => i.piece === piece).map((i) => ({ i, p })));
        expect(items.length).toBeGreaterThan(0);
        const area = items.reduce((a, { i }) => a + (i.clip ? i.clip.w * i.clip.h : piece.width * piece.height), 0);
        expect(area).toBeCloseTo(piece.width * piece.height, 3);
        for (const { i, p } of items) {
          const w = i.clip?.w ?? piece.width;
          const h = i.clip?.h ?? piece.height;
          expect(w).toBeLessThanOrEqual(p.contentW + 1e-6);
          expect(h).toBeLessThanOrEqual(p.contentH + 1e-6);
        }
      }
    }
  });
});

describe('renderers', () => {
  it.each(templates.map((t) => [t.id, t] as const))('%s renders SVG and PDF', async (_id, t) => {
    const pat = t.generate(defaultValues(t));
    expect(patternToSvg(pat, 'in')).toContain('<svg');
    const bytes = await patternToPdf(pat, { templateName: t.name, unit: 'in', params: [['x', 'y']] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1 + paginate(pat.pieces).length);
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect(w).toBeCloseTo(612, 0); // 8.5 in
    expect(h).toBeCloseTo(792, 0); // 11 in
  });
});
