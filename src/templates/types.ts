import type { Pattern } from '../core/pattern';

/**
 * Parameter definitions drive the UI form automatically.
 *  - length:    stored in mm, displayed in mm or inches
 *  - thickness: leather weight in oz (converted to mm by the generator)
 *  - number:    plain number (counts, ratios)
 */
export type ParamDef =
  | { key: string; label: string; kind: 'length'; default: number; min?: number; max?: number; help?: string; group?: string }
  | { key: string; label: string; kind: 'thickness'; default: number; min?: number; max?: number; help?: string; group?: string }
  | { key: string; label: string; kind: 'number'; default: number; min?: number; max?: number; step?: number; integer?: boolean; help?: string; group?: string }
  | { key: string; label: string; kind: 'select'; default: string; options: { value: string; label: string }[]; help?: string; group?: string }
  | { key: string; label: string; kind: 'boolean'; default: boolean; help?: string; group?: string };

export type ParamValues = Record<string, number | string | boolean>;

export interface Preset {
  id: string;
  label: string;
  values: ParamValues;
}

export interface Template {
  id: string;
  name: string;
  category: 'Wallets' | 'Notebook covers' | 'Drop trays';
  description: string;
  params: ParamDef[];
  /** Optional size presets; choosing one overwrites the listed values. */
  presets?: Preset[];
  generate(values: ParamValues): Pattern;
}

export function defaultValues(t: Template): ParamValues {
  return Object.fromEntries(t.params.map((p) => [p.key, p.default]));
}

/** Typed accessors so generators can read values without casting everywhere. */
export function reader(v: ParamValues) {
  return {
    num: (k: string) => Number(v[k]),
    str: (k: string) => String(v[k]),
    bool: (k: string) => Boolean(v[k]),
  };
}

/** Shared parameter blocks so every template asks for stitching the same way. */
export const stitchParams = (defaults: { margin?: number; spacing?: number; corner?: number } = {}): ParamDef[] => [
  {
    key: 'stitchSpacing',
    label: 'Stitch spacing (iron pitch)',
    kind: 'length',
    default: defaults.spacing ?? 3.85,
    min: 1.5,
    max: 10,
    group: 'Stitching',
    help: 'Prong spacing of your pricking iron. Holes are spread evenly between corners as close to this as possible.',
  },
  {
    key: 'stitchMargin',
    label: 'Stitch line from edge',
    kind: 'length',
    default: defaults.margin ?? 4,
    min: 1.5,
    max: 10,
    group: 'Stitching',
  },
  {
    key: 'cornerRadius',
    label: 'Corner radius',
    kind: 'length',
    default: defaults.corner ?? 6,
    min: 0,
    max: 30,
    group: 'Stitching',
  },
];

/** Standard dimensions (mm). */
export const CARD = { w: 85.6, h: 53.98, t: 0.76 } as const; // ISO/IEC 7810 ID-1
export const PASSPORT = { w: 125, h: 88, t: 5 } as const; // ISO/IEC 7810 ID-3 (closed booklet)
