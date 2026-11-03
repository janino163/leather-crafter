# Leather Crafter

Parametric pattern generator for leatherwork. Pick a template, set sizes, leather weight (oz) and your
pricking-iron pitch, and export a **1:1 PDF for US Letter** to print, cut out and trace.

Templates so far: **Card holder**, **Passport wallet**, **Notebook cover (sleeve)**.

## Running

```bash
npm install
npm run app        # build + open the desktop app (Electron)
npm run app:dev    # desktop app with hot reload
npm run dev        # same UI in the browser at http://localhost:5173
npm test           # geometry / template / PDF tests
npm run dist       # package an installer for the current OS (electron-builder)
```

## Printing

Open the exported PDF and print at **100% / Actual size** (never "Fit to page"). Sheet 1 is a cover with a
1 in and a 25 mm calibration square — measure them before cutting. Pieces too big for a sheet are tiled
(A1, A2, …): trim one sheet on the dashed join line, butt it against the next, and tape.

Line key: solid = cut · blue dashed = fold/crease · grey dotted = stitch line · red dots = stitch holes.
Pocket and sleeve holes are subsets of the body/outer holes, so all layers punch in register.

## How it's built

```
src/core/        geometry (lines + arcs, mm), stitch-hole spacing, page layout, SVG + PDF renderers
src/templates/   one module per product: a parameter schema + generate(params) → Pattern
src/ui/          React UI; the form is generated from each template's parameter schema
electron/        thin desktop shell that loads the built UI
```

Adding a product = adding a template module and registering it in `src/templates/index.ts`.

The fit formulas (card-stack allowance, spine width from thickness, ease) are starting heuristics in the
template files — tune them after test builds.

## Roadmap

- [x] Core geometry, stitch hole distribution, Letter PDF with calibration + tiling, SVG export
- [x] Card holder, passport wallet, sleeve notebook cover
- [ ] Drop tray with stitched corners
- [ ] Traveler's-style notebook cover (elastic channels)
- [ ] Saved named presets, pen loop, optional linings

## Troubleshooting

**"Electron failed to install correctly"** — on very new Node versions Electron's zip extraction can stop
before writing `node_modules/electron/path.txt`. Fix (macOS):

```bash
Z=$(find ~/Library/Caches/electron -name "electron-v*-darwin-*.zip" | head -1)
cd node_modules/electron && rm -rf dist && mkdir dist && ditto -x -k "$Z" dist \
  && printf 'Electron.app/Contents/MacOS/Electron' > path.txt
```
