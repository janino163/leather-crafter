import { useEffect, useMemo, useRef, useState } from 'react';
import { patternToPdf } from '../core/pdf';
import { patternToSvg } from '../core/svg';
import { Unit, formatLength, ozToMm } from '../core/units';
import { templates } from '../templates';
import { ParamValues, Template, defaultValues } from '../templates/types';
import { ParamForm } from './ParamForm';

const STORE_KEY = 'leather-crafter:v1';

interface Saved {
  templateId: string;
  unit: Unit;
  values: Record<string, ParamValues>;
  presets: Record<string, string>;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(s: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

export function App() {
  const saved = useMemo(load, []);
  const [templateId, setTemplateId] = useState(saved?.templateId ?? templates[0].id);
  const [unit, setUnit] = useState<Unit>(saved?.unit ?? 'mm');
  const [allValues, setAllValues] = useState<Record<string, ParamValues>>(saved?.values ?? {});
  const [presets, setPresets] = useState<Record<string, string>>(saved?.presets ?? {});
  const [zoom, setZoom] = useState(2);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  // Merge defaults so params added in later versions get a value.
  const values = { ...defaultValues(template), ...(allValues[template.id] ?? {}) };
  const presetId = presets[template.id] ?? template.presets?.[0]?.id ?? 'custom';

  const persist = (patch: Partial<Saved>) => save({ templateId, unit, values: allValues, presets, ...patch });

  const pattern = useMemo(() => {
    try {
      return { ok: true as const, value: template.generate(values) };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  }, [template, JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps

  const svg = useMemo(() => (pattern.ok ? patternToSvg(pattern.value, unit, { grid: true }) : ''), [pattern, unit]);

  // Fit the preview to the available width whenever the template changes.
  const fit = () => {
    const el = canvasRef.current;
    if (el && svg) setZoom(Math.max(0.5, Math.min(8, (el.clientWidth - 48) / svgWidthMm(svg))));
  };
  useEffect(fit, [template.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onValues = (v: ParamValues, newPreset?: string) => {
    const nextValues = { ...allValues, [template.id]: v };
    const nextPresets = { ...presets, [template.id]: newPreset ?? (template.presets ? 'custom' : presetId) };
    setAllValues(nextValues);
    setPresets(nextPresets);
    persist({ values: nextValues, presets: nextPresets });
  };

  const fileBase = `${template.id}-${new Date().toISOString().slice(0, 10)}`;

  async function exportPdf() {
    if (!pattern.ok) return;
    setBusy(true);
    try {
      const bytes = await patternToPdf(pattern.value, { templateName: template.name, unit, params: describeParams(template, values, unit) });
      download(new Blob([bytes], { type: 'application/pdf' }), `${fileBase}.pdf`);
    } finally {
      setBusy(false);
    }
  }
  function exportSvg() {
    if (!pattern.ok) return;
    download(new Blob([patternToSvg(pattern.value, unit)], { type: 'image/svg+xml' }), `${fileBase}.svg`);
  }

  return (
    <div className="app">
      <header>
        <h1>Leather Crafter</h1>
        <nav>
          {templates.map((t) => (
            <button
              key={t.id}
              className={t.id === template.id ? 'tab active' : 'tab'}
              title={t.description}
              onClick={() => {
                setTemplateId(t.id);
                persist({ templateId: t.id });
              }}
            >
              <small>{t.category}</small>
              {t.name}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <div className="seg" role="group" aria-label="Units">
          {(['mm', 'in'] as Unit[]).map((u) => (
            <button
              key={u}
              className={u === unit ? 'active' : ''}
              onClick={() => {
                setUnit(u);
                persist({ unit: u });
              }}
            >
              {u}
            </button>
          ))}
        </div>
        <button className="primary" disabled={!pattern.ok || busy} onClick={exportPdf}>
          {busy ? 'Building…' : 'Export PDF (Letter)'}
        </button>
        <button disabled={!pattern.ok} onClick={exportSvg}>
          SVG
        </button>
      </header>

      <aside className="sidebar">
        <p className="desc">{template.description}</p>
        <ParamForm template={template} values={values} unit={unit} presetId={presetId} onChange={onValues} />
        <button
          className="link"
          onClick={() => {
            const next = { ...allValues };
            delete next[template.id];
            const np = { ...presets };
            delete np[template.id];
            setAllValues(next);
            setPresets(np);
            persist({ values: next, presets: np });
          }}
        >
          Reset to defaults
        </button>
      </aside>

      <main className="preview">
        {pattern.ok ? (
          <div className="canvas" ref={canvasRef}>
            <div className="svgwrap" style={{ width: `${zoom * svgWidthMm(svg)}px` }} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        ) : (
          <div className="error">Could not generate pattern: {pattern.error}</div>
        )}
        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(12, z * 1.25))}>+</button>
          <button onClick={fit}>Fit</button>
          <small>grid = 10 mm</small>
        </div>
      </main>

      <aside className="info">
        {pattern.ok && (
          <>
            {pattern.value.warnings.length > 0 && (
              <section className="warnings">
                <h3>Warnings</h3>
                <ul>
                  {pattern.value.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h3>Summary</h3>
              <dl>
                {pattern.value.summary.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.text ?? formatLength(s.mm ?? 0, unit)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h3>Pieces</h3>
              <table>
                <tbody>
                  {pattern.value.pieces.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>×{p.quantity}</td>
                      <td>
                        {formatLength(p.width, unit, false)} × {formatLength(p.height, unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h3>Assembly</h3>
              <ol>
                {pattern.value.assembly.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

function svgWidthMm(svg: string): number {
  const m = svg.match(/viewBox="0 0 ([\d.]+) /);
  return m ? Number(m[1]) : 100;
}

function describeParams(t: Template, values: ParamValues, unit: Unit): [string, string][] {
  return t.params.map((p) => {
    const v = values[p.key];
    switch (p.kind) {
      case 'length':
        return [p.label, formatLength(Number(v), unit)];
      case 'thickness':
        return [p.label, `${v} oz (${formatLength(ozToMm(Number(v)), 'mm')})`];
      case 'boolean':
        return [p.label, v ? 'Yes' : 'No'];
      case 'select':
        return [p.label, p.options.find((o) => o.value === v)?.label ?? String(v)];
      default:
        return [p.label, String(v)];
    }
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
