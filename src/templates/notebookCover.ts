import { bifoldParams, generateBifold } from './bifoldSleeve';
import { Preset, Template } from './types';

/** Common notebook sizes (single cover board width × height, closed thickness), mm. */
const SIZES: { id: string; label: string; w: number; h: number; t: number }[] = [
  { id: 'a5', label: 'A5 (148 × 210)', w: 148, h: 210, t: 15 },
  { id: 'a6', label: 'A6 (105 × 148)', w: 105, h: 148, t: 12 },
  { id: 'b6', label: 'B6 (125 × 176)', w: 125, h: 176, t: 12 },
  { id: 'tn-regular', label: "Traveler's Regular (110 × 210)", w: 110, h: 210, t: 6 },
  { id: 'tn-passport', label: "Traveler's Passport (89 × 124)", w: 89, h: 124, t: 6 },
  { id: 'field-notes', label: 'Field Notes / pocket (89 × 140)', w: 89, h: 140, t: 4 },
  { id: 'composition', label: 'Composition (190 × 248)', w: 190, h: 248, t: 12 },
];

const presets: Preset[] = SIZES.map((s) => ({
  id: s.id,
  label: s.label,
  values: { itemW: s.w, itemH: s.h, itemT: s.t, leftFlap: Math.round(s.w * 0.55), rightFlap: Math.round(s.w * 0.55) },
}));

export const notebookCover: Template = {
  id: 'notebook-cover-sleeve',
  name: 'Notebook cover (sleeve)',
  category: 'Notebook covers',
  description: 'Sleeve-style cover: the notebook’s own cardboard covers slide into sleeves on each side.',
  presets,
  params: bifoldParams({ itemW: 148, itemH: 210, itemT: 15, thicknessOz: 3.5, leftFlap: 81, rightFlap: 81, cardSlots: 0, itemLabel: 'Notebook' }),
  generate: (v) => generateBifold(v, 'Notebook cover (sleeve)', 'Notebook'),
};
