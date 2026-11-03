// Minimal 2D path model: lines and circular arcs, y axis pointing DOWN (SVG convention), units mm.

export interface Pt {
  x: number;
  y: number;
}

export type Seg =
  | { kind: 'line'; from: Pt; to: Pt }
  /** Circular arc around `center`, sweeping from angle a0 to a1 (radians, y-down, so increasing = clockwise on screen). */
  | { kind: 'arc'; center: Pt; r: number; a0: number; a1: number };

export interface Path {
  segs: Seg[];
  closed: boolean;
}

export const pt = (x: number, y: number): Pt => ({ x, y });
const EPS = 1e-6;

export function segStart(s: Seg): Pt {
  return s.kind === 'line' ? s.from : polar(s.center, s.r, s.a0);
}
export function segEnd(s: Seg): Pt {
  return s.kind === 'line' ? s.to : polar(s.center, s.r, s.a1);
}
export function segLength(s: Seg): number {
  return s.kind === 'line' ? dist(s.from, s.to) : Math.abs(s.a1 - s.a0) * s.r;
}
/** Point at parameter t ∈ [0,1] along a segment. */
export function segPointAt(s: Seg, t: number): Pt {
  if (s.kind === 'line') return pt(s.from.x + (s.to.x - s.from.x) * t, s.from.y + (s.to.y - s.from.y) * t);
  return polar(s.center, s.r, s.a0 + (s.a1 - s.a0) * t);
}
/** Unit tangent direction at parameter t. */
export function segTangent(s: Seg, t: number): Pt {
  if (s.kind === 'line') {
    const L = dist(s.from, s.to) || 1;
    return pt((s.to.x - s.from.x) / L, (s.to.y - s.from.y) / L);
  }
  const a = s.a0 + (s.a1 - s.a0) * t;
  const dir = Math.sign(s.a1 - s.a0) || 1;
  return pt(-Math.sin(a) * dir, Math.cos(a) * dir);
}

export function polar(c: Pt, r: number, a: number): Pt {
  return pt(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export const pathLength = (p: Path) => p.segs.reduce((acc, s) => acc + segLength(s), 0);

export const line = (from: Pt, to: Pt): Seg => ({ kind: 'line', from, to });
export const arc = (center: Pt, r: number, a0: number, a1: number): Seg => ({ kind: 'arc', center, r, a0, a1 });

export interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}
export const radii = (r: number): CornerRadii => ({ tl: r, tr: r, br: r, bl: r });

/**
 * Rounded rectangle as an ordered segment list, clockwise on screen, starting at the top edge.
 * Order: top line, tr arc, right line, br arc, bottom line, bl arc, left line, tl arc.
 * Zero-radius corners and zero-length lines are omitted.
 */
export function roundedRectSegs(x: number, y: number, w: number, h: number, rr: CornerRadii): Seg[] {
  const max = Math.min(w, h) / 2;
  const r = {
    tl: clamp(rr.tl, 0, max),
    tr: clamp(rr.tr, 0, max),
    br: clamp(rr.br, 0, max),
    bl: clamp(rr.bl, 0, max),
  };
  const H = Math.PI / 2;
  const out: Seg[] = [];
  const pushLine = (a: Pt, b: Pt) => {
    if (dist(a, b) > EPS) out.push(line(a, b));
  };
  pushLine(pt(x + r.tl, y), pt(x + w - r.tr, y));
  if (r.tr > EPS) out.push(arc(pt(x + w - r.tr, y + r.tr), r.tr, -H, 0));
  pushLine(pt(x + w, y + r.tr), pt(x + w, y + h - r.br));
  if (r.br > EPS) out.push(arc(pt(x + w - r.br, y + h - r.br), r.br, 0, H));
  pushLine(pt(x + w - r.br, y + h), pt(x + r.bl, y + h));
  if (r.bl > EPS) out.push(arc(pt(x + r.bl, y + h - r.bl), r.bl, H, 2 * H));
  pushLine(pt(x, y + h - r.bl), pt(x, y + r.tl));
  if (r.tl > EPS) out.push(arc(pt(x + r.tl, y + r.tl), r.tl, 2 * H, 3 * H));
  return out;
}

export function roundedRect(x: number, y: number, w: number, h: number, rr: CornerRadii): Path {
  return { segs: roundedRectSegs(x, y, w, h, rr), closed: true };
}

/** Stitch-line radii for a stitch line inset `m` from an edge with corner radii `rr`. */
export function insetRadii(rr: CornerRadii, m: number): CornerRadii {
  return { tl: Math.max(rr.tl - m, 0), tr: Math.max(rr.tr - m, 0), br: Math.max(rr.br - m, 0), bl: Math.max(rr.bl - m, 0) };
}

export function translatePath(p: Path, dx: number, dy: number): Path {
  return {
    closed: p.closed,
    segs: p.segs.map((s) =>
      s.kind === 'line'
        ? line(pt(s.from.x + dx, s.from.y + dy), pt(s.to.x + dx, s.to.y + dy))
        : arc(pt(s.center.x + dx, s.center.y + dy), s.r, s.a0, s.a1),
    ),
  };
}

/** Mirror a path horizontally about the vertical line x = axis. */
export function mirrorPathX(p: Path, axis: number): Path {
  const mx = (q: Pt) => pt(2 * axis - q.x, q.y);
  return {
    closed: p.closed,
    segs: p.segs.map((s) => (s.kind === 'line' ? line(mx(s.from), mx(s.to)) : arc(mx(s.center), s.r, Math.PI - s.a0, Math.PI - s.a1))),
  };
}

/** Serialize to an SVG path `d` string, with an optional point transform (e.g. mm → pt). */
export function pathToSvgD(p: Path, map: (q: Pt) => Pt = (q) => q, scale = 1): string {
  const f = (n: number) => +n.toFixed(4);
  let d = '';
  let cur: Pt | null = null;
  for (const s of p.segs) {
    const a = segStart(s);
    if (!cur || dist(cur, a) > 1e-4) {
      const m = map(a);
      d += `M${f(m.x)} ${f(m.y)}`;
    }
    const e = segEnd(s);
    const me = map(e);
    if (s.kind === 'line') d += `L${f(me.x)} ${f(me.y)}`;
    else {
      // Arcs ≥ 180° are split so SVG flags stay unambiguous.
      const span = s.a1 - s.a0;
      const pieces = Math.ceil(Math.abs(span) / (Math.PI * 0.99));
      for (let i = 1; i <= pieces; i++) {
        const q = map(polar(s.center, s.r, s.a0 + (span * i) / pieces));
        d += `A${f(s.r * scale)} ${f(s.r * scale)} 0 0 ${span > 0 ? 1 : 0} ${f(q.x)} ${f(q.y)}`;
      }
    }
    cur = e;
  }
  if (p.closed) d += 'Z';
  return d;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
