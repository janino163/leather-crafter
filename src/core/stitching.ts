import { Path, Pt, Seg, dist, segEnd, segLength, segPointAt, segStart, segTangent } from './geometry';

/**
 * Place stitch holes along a path.
 *
 * The path is split into "runs" at sharp corners (where the direction changes abruptly). A hole is always
 * placed exactly on each sharp corner and at the ends of an open path, and holes inside a run are spaced
 * evenly — as close to `spacing` as possible — so the pricking iron lands cleanly into corners. Smooth
 * transitions (line → rounded corner) don't break a run, so spacing stays uniform around curves.
 */
export function stitchHoles(path: Path, spacing: number): Pt[] {
  const runs = splitRuns(path);
  const holes: Pt[] = [];
  for (const run of runs) {
    const L = run.reduce((a, s) => a + segLength(s), 0);
    if (L < 1e-6) continue;
    const n = Math.max(1, Math.round(L / spacing));
    const step = L / n;
    for (let i = 0; i <= n; i++) holes.push(pointAtDistance(run, i * step));
  }
  return dedupe(holes, Math.min(spacing * 0.25, 0.5));
}

/** Actual spacing per run after even distribution (useful for warnings / labels). */
export function actualSpacings(path: Path, spacing: number): number[] {
  return splitRuns(path).map((run) => {
    const L = run.reduce((a, s) => a + segLength(s), 0);
    return L / Math.max(1, Math.round(L / spacing));
  });
}

/** Holes in a straight line from `from` toward `to`, at exactly `spacing`, starting on `from`. */
export function holesAlongLine(from: Pt, to: Pt, spacing: number): Pt[] {
  const L = dist(from, to);
  const out: Pt[] = [];
  for (let d = 0; d <= L + 1e-6; d += spacing) {
    const t = d / L;
    out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  return out;
}

function splitRuns(path: Path): Seg[][] {
  const segs = path.segs.filter((s) => segLength(s) > 1e-6);
  if (!segs.length) return [];
  const isSharp = (a: Seg, b: Seg) => {
    const ta = segTangent(a, 1);
    const tb = segTangent(b, 0);
    return ta.x * tb.x + ta.y * tb.y < Math.cos((10 * Math.PI) / 180) || dist(segEnd(a), segStart(b)) > 1e-3;
  };

  if (path.closed) {
    // Rotate so the list starts right after a sharp corner (if any), then split.
    const sharpIdx: number[] = [];
    for (let i = 0; i < segs.length; i++) if (isSharp(segs[(i - 1 + segs.length) % segs.length], segs[i])) sharpIdx.push(i);
    if (!sharpIdx.length) return [segs]; // fully smooth loop: one run
    const start = sharpIdx[0];
    const rotated = [...segs.slice(start), ...segs.slice(0, start)];
    return splitOpen(rotated, isSharp);
  }
  return splitOpen(segs, isSharp);
}

function splitOpen(segs: Seg[], isSharp: (a: Seg, b: Seg) => boolean): Seg[][] {
  const runs: Seg[][] = [[segs[0]]];
  for (let i = 1; i < segs.length; i++) {
    if (isSharp(segs[i - 1], segs[i])) runs.push([segs[i]]);
    else runs[runs.length - 1].push(segs[i]);
  }
  return runs;
}

function pointAtDistance(run: Seg[], d: number): Pt {
  let acc = 0;
  for (const s of run) {
    const L = segLength(s);
    if (d <= acc + L + 1e-9) return segPointAt(s, L ? (d - acc) / L : 0);
    acc += L;
  }
  return segEnd(run[run.length - 1]);
}

function dedupe(points: Pt[], tol: number): Pt[] {
  const out: Pt[] = [];
  for (const p of points) if (!out.some((q) => dist(p, q) < tol)) out.push(p);
  return out;
}
