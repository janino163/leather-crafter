import { Path, Pt, arc, line, mirrorPathX, pt, radii, roundedRect, insetRadii } from '../core/geometry';
import { Pattern, Piece } from '../core/pattern';
import { holesAlongLine, stitchHoles } from '../core/stitching';
import { ozToMm } from '../core/units';
import { holesIn, spacingSummary } from './helpers';
import { CARD, ParamDef, ParamValues, reader, stitchParams } from './types';

/**
 * Bifold sleeve cover — shared by the passport wallet and sleeve-style notebook cover.
 *
 *   ┌──────────────┬───┬──────────────┐   Outer panel: stitched all round.
 *   │ left sleeve  ┊   ┊ right sleeve │   Sleeves (flaps) are stitched on 3 sides; the item's
 *   │ (+card slots)┊sp ┊              │   covers slide in from the spine side.
 *   └──────────────┴───┴──────────────┘
 */
export interface BifoldDefaults {
  itemW: number;
  itemH: number;
  itemT: number;
  thicknessOz: number;
  leftFlap: number;
  rightFlap: number;
  cardSlots: number;
  itemLabel: string;
}

export function bifoldParams(d: BifoldDefaults): ParamDef[] {
  return [
    { key: 'itemW', label: `${d.itemLabel} width (one cover)`, kind: 'length', default: d.itemW, min: 40, max: 400, group: 'Item' },
    { key: 'itemH', label: `${d.itemLabel} height`, kind: 'length', default: d.itemH, min: 40, max: 400, group: 'Item' },
    { key: 'itemT', label: `${d.itemLabel} thickness (closed)`, kind: 'length', default: d.itemT, min: 1, max: 60, group: 'Item' },
    { key: 'thicknessOz', label: 'Leather thickness', kind: 'thickness', default: d.thicknessOz, min: 1, max: 6, group: 'Leather' },
    { key: 'leftFlap', label: 'Left sleeve width', kind: 'length', default: d.leftFlap, min: 20, max: 250, group: 'Sleeves' },
    { key: 'rightFlap', label: 'Right sleeve width', kind: 'length', default: d.rightFlap, min: 20, max: 250, group: 'Sleeves' },
    { key: 'cardSlots', label: 'Card slots (left sleeve)', kind: 'number', default: d.cardSlots, min: 0, max: 4, integer: true, group: 'Sleeves' },
    { key: 'cardsPerSlot', label: 'Cards per slot', kind: 'number', default: 1, min: 1, max: 4, integer: true, group: 'Sleeves' },
    { key: 'slotTopGap', label: 'Top slot below sleeve top', kind: 'length', default: 18, min: 5, max: 80, group: 'Sleeves' },
    { key: 'slotStep', label: 'Slot step', kind: 'length', default: 16, min: 8, max: 40, group: 'Sleeves' },
    { key: 'widthEase', label: 'Extra width (ease)', kind: 'length', default: 3, min: 0, max: 15, group: 'Fit', help: 'Added to the item width per side.' },
    { key: 'heightEase', label: 'Extra height (ease)', kind: 'length', default: 3, min: 0, max: 15, group: 'Fit' },
    { key: 'spineEase', label: 'Extra spine', kind: 'length', default: 1, min: 0, max: 20, group: 'Fit', help: 'Added to the computed spine. Increase if the cover will not close flat.' },
    ...stitchParams({ margin: 4, spacing: 3.85, corner: 6 }),
  ];
}

export function generateBifold(values: ParamValues, title: string, itemLabel: string): Pattern {
  const v = reader(values);
  const t = ozToMm(v.num('thicknessOz'));
  const m = v.num('stitchMargin');
  const s = v.num('stitchSpacing');
  const r = v.num('cornerRadius');
  const slots = v.num('cardSlots');
  const perSlot = v.num('cardsPerSlot');
  const FL = v.num('leftFlap');
  const FR = v.num('rightFlap');
  const warnings: string[] = [];

  const H = v.num('itemH') + v.num('heightEase') + 2 * m;
  const half = v.num('itemW') + v.num('widthEase') + m;
  // When closed, the outer leather wraps the whole inside stack: item + both sleeves + slot layers + cards,
  // measured on the leather's neutral axis (≈ +1 thickness).
  const insideStack = v.num('itemT') + 2 * t + slots * t + slots * perSlot * CARD.t;
  const spine = insideStack + t + v.num('spineEase');
  const W = 2 * half + spine;

  if (FL > half - 8) warnings.push(`Left sleeve (${FL.toFixed(0)} mm) reaches into the spine fold — keep it under ${(half - 8).toFixed(0)} mm.`);
  if (FR > half - 8) warnings.push(`Right sleeve (${FR.toFixed(0)} mm) reaches into the spine fold — keep it under ${(half - 8).toFixed(0)} mm.`);

  const rs = Math.max(r - m, 0);
  const outerStitch = roundedRect(m, m, W - 2 * m, H - 2 * m, insetRadii(radii(r), m));
  const outerHoles = stitchHoles(outerStitch, s);
  const gap = Math.max(m * 0.5, 1.5);
  const foldX = [half, half + spine];

  const pieces: Piece[] = [
    {
      id: 'outer',
      name: 'Outer',
      quantity: 1,
      note: `Spine ${spine.toFixed(1)} mm between fold lines`,
      width: W,
      height: H,
      cut: [roundedRect(0, 0, W, H, radii(r))],
      fold: foldX.map((x): Path => ({ segs: [line(pt(x, 0), pt(x, H))], closed: false })),
      stitch: [outerStitch],
      holes: outerHoles,
    },
  ];

  // ---- Left sleeve (optionally carrying card slots) ----
  let leftHoles = holesIn(outerHoles, { x0: 0, y0: 0, x1: FL - gap, y1: H });
  const leftStitch: Path[] = [cStitch(FL - gap, H, m, rs)];
  const slotPieces: Piece[] = [];
  if (slots > 0) {
    // The slots' inner edge gets its own stitch line; snap it onto an existing bottom hole so the
    // two lines share a hole at the corner.
    const bottom = outerHoles.filter((h) => Math.abs(h.y - (H - m)) < 0.01 && h.x <= FL - m + 1e-6);
    const xLine = bottom.length ? Math.max(...bottom.map((h) => h.x)) : FL - m;
    const need = CARD.w + 1.5 + perSlot * CARD.t + t;
    if (xLine - m < need) {
      warnings.push(`Card slots need ≈ ${(need + 2 * m + 2).toFixed(0)} mm of left sleeve width; currently ${FL.toFixed(0)} mm.`);
    }
    const heights = Array.from({ length: slots }, (_, i) => H - v.num('slotTopGap') - i * v.num('slotStep'));
    const top0 = H - heights[0];
    const lineHoles = holesAlongLine(pt(xLine, H - m), pt(xLine, top0 + gap), s).slice(1);
    leftHoles = [...leftHoles, ...lineHoles];
    leftStitch.push({ segs: [line(pt(xLine, H - m), pt(xLine, top0 + gap))], closed: false });

    heights.forEach((h, i) => {
      const y0 = H - h;
      if (h - m - gap < CARD.h * 0.45) warnings.push(`Card slot ${i + 1} is shallow (${(h - m).toFixed(0)} mm) — cards may slip out.`);
      if (h < 20) return;
      slotPieces.push({
        id: `slot-${i + 1}`,
        name: `Card slot ${i + 1}`,
        quantity: 1,
        note: i === 0 ? 'Tallest; goes against the left sleeve' : `Sits on top of slot ${i}`,
        width: FL,
        height: h,
        cut: [roundedRect(0, 0, FL, h, { tl: 0, tr: 0, br: 0, bl: r })],
        fold: [],
        stitch: [
          lStitch(xLine, h, m, rs, gap),
          { segs: [line(pt(xLine, h - m), pt(xLine, gap))], closed: false },
        ],
        holes: holesIn(leftHoles, { x0: 0, y0: y0 + gap, x1: FL, y1: H }, pt(0, y0)),
      });
    });
  }
  pieces.push({
    id: 'left-sleeve',
    name: 'Left sleeve',
    quantity: 1,
    note: slots ? 'Card slots stitch onto this first' : undefined,
    width: FL,
    height: H,
    cut: [roundedRect(0, 0, FL, H, { tl: r, tr: 0, br: 0, bl: r })],
    fold: [],
    stitch: leftStitch,
    holes: leftHoles,
  });

  // ---- Right sleeve: mirror image of a plain left sleeve ----
  const rightOrigin: Pt = pt(W - FR, 0);
  pieces.push({
    id: 'right-sleeve',
    name: 'Right sleeve',
    quantity: 1,
    width: FR,
    height: H,
    cut: [roundedRect(0, 0, FR, H, { tl: 0, tr: r, br: r, bl: 0 })],
    fold: [],
    stitch: [mirrorPathX(cStitch(FR - gap, H, m, rs), FR / 2)],
    holes: holesIn(outerHoles, { x0: W - FR + gap, y0: 0, x1: W, y1: H }, rightOrigin),
  });
  pieces.push(...slotPieces);

  return {
    title,
    pieces,
    warnings,
    summary: [
      { label: 'Closed size', text: `${half.toFixed(1)} × ${H.toFixed(1)} mm` },
      { label: 'Open width', mm: W },
      { label: 'Height', mm: H },
      { label: 'Spine', mm: spine },
      { label: 'Leather thickness', text: `${t.toFixed(2)} mm` },
      { label: 'Actual stitch spacing', text: spacingSummary([outerStitch], s) },
      { label: 'Holes (outer)', text: String(outerHoles.length) },
    ],
    assembly: [
      'Cut all pieces. Finish the free (spine-side) edges of both sleeves and the top edge of each card slot first.',
      ...(slots
        ? [
            'Stack the card slots onto the left sleeve (slot 1 first), aligning bottom and outer edges. Glue along the stitch lines.',
            'Stitch the slots’ inner vertical line through the slots and left sleeve only.',
          ]
        : []),
      'Crease the outer along the fold lines (dampen the flesh side lightly) and close it around the item to check fit before gluing.',
      `Glue the sleeves to the outer along their stitch lines, with the ${itemLabel.toLowerCase()} closed inside so the spine sets at its working thickness.`,
      'Punch through all layers using the outer’s hole marks, and saddle stitch all the way around.',
      'Sand, bevel and burnish the perimeter.',
    ],
  };
}

/** Sleeve stitch line for a left-side sleeve: along the top, down the outer side, along the bottom. */
function cStitch(xEnd: number, H: number, m: number, rs: number): Path {
  const Q = Math.PI / 2;
  const segs = [line(pt(xEnd, m), pt(m + rs, m))];
  if (rs > 0) segs.push(arc(pt(m + rs, m + rs), rs, 3 * Q, 2 * Q));
  segs.push(line(pt(m, m + rs), pt(m, H - m - rs)));
  if (rs > 0) segs.push(arc(pt(m + rs, H - m - rs), rs, 2 * Q, Q));
  segs.push(line(pt(m + rs, H - m), pt(xEnd, H - m)));
  return { segs, closed: false };
}

/** Card slot stitch: from the inner line along the bottom, around the corner, up the outer side. */
function lStitch(xLine: number, h: number, m: number, rs: number, gap: number): Path {
  const Q = Math.PI / 2;
  const segs = [line(pt(xLine, h - m), pt(m + rs, h - m))];
  if (rs > 0) segs.push(arc(pt(m + rs, h - m - rs), rs, Q, 2 * Q));
  segs.push(line(pt(m, h - m - rs), pt(m, gap)));
  return { segs, closed: false };
}
