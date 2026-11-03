import { Seg, arc, line, pt, roundedRect, roundedRectSegs } from '../core/geometry';
import { Pattern, Piece } from '../core/pattern';
import { stitchHoles } from '../core/stitching';
import { ozToMm } from '../core/units';
import { holesIn, spacingSummary, uStitchPath } from './helpers';
import { CARD, Template, reader, stitchParams } from './types';

/**
 * Minimalist card holder: two body panels stitched on three sides form a centre slot, with optional
 * stepped pockets on one or both faces. All layers share one set of stitch holes.
 */
export const cardHolder: Template = {
  id: 'card-holder',
  name: 'Card holder',
  category: 'Wallets',
  description: 'Slim card holder with a centre slot and stepped pockets on each face.',
  params: [
    { key: 'thicknessOz', label: 'Leather thickness', kind: 'thickness', default: 2.5, min: 1, max: 6, group: 'Leather' },
    { key: 'cardsPerSlot', label: 'Cards per slot', kind: 'number', default: 3, min: 1, max: 8, integer: true, group: 'Layout' },
    { key: 'pocketsPerSide', label: 'Pockets per face', kind: 'number', default: 1, min: 0, max: 3, integer: true, group: 'Layout' },
    {
      key: 'pocketSides',
      label: 'Pockets on',
      kind: 'select',
      default: 'both',
      options: [
        { value: 'both', label: 'Both faces' },
        { value: 'front', label: 'Front face only' },
      ],
      group: 'Layout',
    },
    { key: 'pocketStep', label: 'Pocket step (drop per pocket)', kind: 'length', default: 14, min: 6, max: 30, group: 'Layout' },
    { key: 'thumbNotch', label: 'Thumb notch on front', kind: 'boolean', default: true, group: 'Layout' },
    { key: 'widthEase', label: 'Extra width (ease)', kind: 'length', default: 2, min: 0, max: 8, group: 'Fit', help: 'Added to card width beyond the thickness allowance. Increase for a looser fit.' },
    ...stitchParams({ margin: 4, spacing: 3.85, corner: 6 }),
  ],
  generate(values): Pattern {
    const v = reader(values);
    const t = ozToMm(v.num('thicknessOz'));
    const n = v.num('cardsPerSlot');
    const p = v.num('pocketsPerSide');
    const step = v.num('pocketStep');
    const m = v.num('stitchMargin');
    const s = v.num('stitchSpacing');
    const r = v.num('cornerRadius');
    const bothSides = v.str('pocketSides') === 'both';
    const warnings: string[] = [];

    // Card stack pushes the leather outward; allow ~half the stack + one leather thickness of extra width.
    const stack = n * CARD.t;
    const W = CARD.w + v.num('widthEase') + 0.5 * stack + t + 2 * m;
    // Cards sit flush with the top of the centre slot.
    const bottomEase = 1.5 + 0.5 * stack;
    const H = CARD.h + bottomEase + m;

    const rs = Math.max(r - m, 0);
    const stitchTop = m + rs;
    const bodyStitch = uStitchPath(m, W - 2 * m, stitchTop, H - m, rs, rs);
    const bodyHoles = stitchHoles(bodyStitch, s);
    const pieces: Piece[] = [];

    // Front body (optionally with a thumb notch to push cards out of the centre slot).
    const notchR = 11;
    const notchD = 9;
    const frontSegs = roundedRectSegs(0, 0, W, H, { tl: r, tr: r, br: r, bl: r });
    if (v.bool('thumbNotch') && frontSegs[0]?.kind === 'line') {
      const cx = W / 2;
      const cy = -(notchR - notchD);
      const alpha = Math.asin((notchR - notchD) / notchR);
      const hw = notchR * Math.cos(alpha);
      const top = frontSegs[0];
      const notch: Seg[] = [
        line(top.from, pt(cx - hw, 0)),
        arc(pt(cx, cy), notchR, Math.PI - alpha, alpha),
        line(pt(cx + hw, 0), top.to),
      ];
      frontSegs.splice(0, 1, ...notch);
      if (p > 0 && step <= notchD + 2) warnings.push('Pocket step is shallower than the thumb notch — the notch will be hidden by the first pocket.');
    }
    const body = (id: string, name: string, quantity: number, segs: Seg[], note?: string): Piece => ({
      id,
      name,
      quantity,
      note,
      width: W,
      height: H,
      cut: [{ segs, closed: true }],
      fold: [],
      stitch: [bodyStitch],
      holes: bodyHoles,
    });
    const notched = v.bool('thumbNotch');
    if (notched) {
      pieces.push(body('front', 'Front body', 1, frontSegs, 'Thumb notch at top'));
      pieces.push(body('back', 'Back body', 1, roundedRectSegs(0, 0, W, H, { tl: r, tr: r, br: r, bl: r })));
    } else {
      pieces.push(body('body', 'Body', 2, frontSegs, 'Front and back'));
    }

    // Stepped pockets: pocket k sits k·step lower than the body top; all bottoms align with the body.
    const gap = Math.max(m * 0.5, 1.5); // first hole sits this far below the pocket's top edge
    for (let k = 1; k <= p; k++) {
      const h = H - k * step;
      const y0 = H - h;
      const holdDepth = h - m - bottomEase;
      if (holdDepth < 18) warnings.push(`Pocket ${k} only grips ${holdDepth.toFixed(0)} mm of card — reduce pockets or pocket step.`);
      if (h <= m * 2 + 5) {
        warnings.push(`Pocket ${k} is too short to build; skipped.`);
        continue;
      }
      pieces.push({
        id: `pocket-${k}`,
        name: `Pocket ${k}`,
        quantity: bothSides ? 2 : 1,
        note: k === 1 ? 'Tallest; goes against the body' : `Sits on top of pocket ${k - 1}`,
        width: W,
        height: h,
        cut: [roundedRect(0, 0, W, h, { tl: 0, tr: 0, br: r, bl: r })],
        fold: [],
        stitch: [uStitchPath(m, W - 2 * m, gap, h - m, rs, rs)],
        holes: holesIn(bodyHoles, { x0: 0, y0: y0 + gap, x1: W, y1: H }, pt(0, y0)),
      });
    }

    const layers = 2 + p * (bothSides ? 2 : 1);
    return {
      title: 'Card holder',
      pieces,
      warnings,
      summary: [
        { label: 'Width', mm: W },
        { label: 'Height', mm: H },
        { label: 'Leather thickness', text: `${t.toFixed(2)} mm` },
        { label: 'Layers at stitch line', text: `${layers} (≈ ${(layers * t).toFixed(1)} mm)` },
        { label: 'Actual stitch spacing', text: spacingSummary([bodyStitch], s) },
        { label: 'Holes per body', text: String(bodyHoles.length) },
      ],
      assembly: [
        'Cut all pieces with the grain running vertically. Finish (bevel, burnish) the top edges of every pocket and the body tops before assembly — they are not reachable later.',
        'Punch stitch holes using the marks on each piece; pocket holes coincide with the body holes.',
        p > 0 ? `Stack pockets onto ${bothSides ? 'each body' : 'the front body'}, aligning bottoms and sides (pocket ${p} outermost), and glue a thin strip along the stitch lines.` : 'Glue the two bodies together along the stitch line only.',
        'Glue front and back bodies together along the stitch line, keeping the centre open.',
        'Saddle stitch around sides and bottom, back-stitching 1–2 holes at each top corner for strength.',
        'Sand the edges flush, then bevel and burnish.',
      ],
    };
  },
};
