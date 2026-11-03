import { useEffect, useState } from 'react';
import { MM_PER_IN, Unit, formatLength, fromDisplay, ozToMm, toDisplay } from '../core/units';
import type { ParamDef, ParamValues, Template } from '../templates/types';

interface Props {
  template: Template;
  values: ParamValues;
  unit: Unit;
  presetId: string;
  onChange(values: ParamValues, presetId?: string): void;
}

export function ParamForm({ template, values, unit, presetId, onChange }: Props) {
  const groups = new Map<string, ParamDef[]>();
  for (const p of template.params) {
    const g = p.group ?? 'Options';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(p);
  }
  const set = (key: string, v: number | string | boolean) => onChange({ ...values, [key]: v });

  return (
    <div className="form">
      {template.presets && (
        <fieldset>
          <legend>Size preset</legend>
          <select
            value={presetId}
            onChange={(e) => {
              const preset = template.presets!.find((p) => p.id === e.target.value);
              if (preset) onChange({ ...values, ...preset.values }, preset.id);
              else onChange(values, 'custom');
            }}
          >
            {template.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </fieldset>
      )}
      {[...groups].map(([group, params]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {params.map((p) => (
            <Field key={p.key} def={p} value={values[p.key]} unit={unit} onChange={(v) => set(p.key, v)} />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function Field({ def, value, unit, onChange }: { def: ParamDef; value: ParamValues[string]; unit: Unit; onChange(v: number | string | boolean): void }) {
  const help = def.help ? <small className="help">{def.help}</small> : null;
  if (def.kind === 'boolean') {
    return (
      <label className="field check">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span>{def.label}</span>
        {help}
      </label>
    );
  }
  if (def.kind === 'select') {
    return (
      <label className="field">
        <span>{def.label}</span>
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {help}
      </label>
    );
  }
  if (def.kind === 'length') {
    const step = unit === 'mm' ? 0.5 : 1 / 32;
    return (
      <NumberField
        label={def.label}
        suffix={unit}
        value={toDisplay(Number(value), unit)}
        decimals={unit === 'mm' ? 2 : 4}
        step={step}
        min={def.min !== undefined ? toDisplay(def.min, unit) : undefined}
        max={def.max !== undefined ? toDisplay(def.max, unit) : undefined}
        onChange={(v) => onChange(fromDisplay(v, unit))}
        help={help}
      />
    );
  }
  if (def.kind === 'thickness') {
    const mm = ozToMm(Number(value));
    return (
      <NumberField
        label={def.label}
        suffix="oz"
        value={Number(value)}
        decimals={2}
        step={0.5}
        min={def.min}
        max={def.max}
        onChange={onChange}
        help={<small className="help">≈ {formatLength(mm, 'mm')} / {(mm / MM_PER_IN).toFixed(3)} in</small>}
      />
    );
  }
  return (
    <NumberField
      label={def.label}
      value={Number(value)}
      decimals={def.integer ? 0 : 2}
      step={def.step ?? 1}
      min={def.min}
      max={def.max}
      onChange={(v) => onChange(def.integer ? Math.round(v) : v)}
      help={help}
    />
  );
}

/** Number input that lets you type freely and only commits valid, in-range values. */
function NumberField(props: {
  label: string;
  value: number;
  suffix?: string;
  decimals: number;
  step: number;
  min?: number;
  max?: number;
  help?: React.ReactNode;
  onChange(v: number): void;
}) {
  const fmt = (n: number) => String(+n.toFixed(props.decimals));
  const [text, setText] = useState(fmt(props.value));
  useEffect(() => setText(fmt(props.value)), [props.value, props.decimals]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Number(text);
  const invalid = text.trim() === '' || !Number.isFinite(n) || (props.min !== undefined && n < props.min - 1e-9) || (props.max !== undefined && n > props.max + 1e-9);

  return (
    <label className="field">
      <span>{props.label}</span>
      <div className="num">
        <input
          type="number"
          className={invalid ? 'invalid' : ''}
          value={text}
          step={props.step}
          min={props.min}
          max={props.max}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            const ok = e.target.value.trim() !== '' && Number.isFinite(v) && !(props.min !== undefined && v < props.min - 1e-9) && !(props.max !== undefined && v > props.max + 1e-9);
            if (ok) props.onChange(v);
          }}
          onBlur={() => setText(fmt(props.value))}
        />
        {props.suffix && <em>{props.suffix}</em>}
      </div>
      {invalid && props.min !== undefined && props.max !== undefined && (
        <small className="help err">
          Range {fmt(props.min)}–{fmt(props.max)}
        </small>
      )}
      {props.help}
    </label>
  );
}
