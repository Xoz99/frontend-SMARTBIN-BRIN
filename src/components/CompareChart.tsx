"use client";

// Grafik garis multi-seri untuk membandingkan metrik antar transport (LoRa vs HTTP)
// pada satu sumbu (satuan sama). ≥2 seri → legend wajib (dataviz). Crosshair vertikal
// + tooltip menampilkan nilai tiap seri pada titik terdekat dari kursor.

import React, { useMemo, useState } from "react";

export interface CompareSeries {
  name: string;
  color: string;
  points: { t: number; v: number }[]; // kronologis naik
}

interface CompareChartProps {
  title: string;
  unit: string;
  series: CompareSeries[];
  decimals?: number;
  hint?: string;
  rangeLabel?: string; // periode filter aktif (mis. "minggu ini") — konteks sumbu waktu
}

const W = 560;
const H = 232;
const PAD = { l: 48, r: 16, t: 16, b: 40 }; // b lebih lega: label sumbu-X 2 baris (tanggal + jam)

const fmtDay = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
const fmtClock = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtFull = (t: number) =>
  `${new Date(t).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} • ${fmtClock(t)}`;

export default function CompareChart({ title, unit, series, decimals = 0, hint, rangeLabel }: CompareChartProps) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const all = useMemo(() => series.flatMap((s) => s.points), [series]);
  const hasData = all.length > 0;

  const { yMin, yMax } = useMemo(() => {
    if (!hasData) return { yMin: 0, yMax: 1 };
    let lo = Infinity, hi = -Infinity;
    for (const p of all) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    return { yMin: lo - pad, yMax: hi + pad };
  }, [all, hasData]);

  const tMin = hasData ? Math.min(...all.map((p) => p.t)) : 0;
  const tMax = hasData ? Math.max(...all.map((p) => p.t)) : 1;
  const tSpan = Math.max(1, tMax - tMin);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + ((t - tMin) / tSpan) * plotW;
  const sy = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const gridY = [0, 1, 2, 3].map((i) => {
    const v = yMax - (i / 3) * (yMax - yMin);
    return { v, y: sy(v) };
  });
  const xTicks = hasData ? [0, 0.5, 1].map((f) => ({ t: tMin + f * tSpan, x: PAD.l + f * plotW })) : [];
  // Data lintas hari → tiap tick dikasih tanggalnya. Kalau satu hari saja, tanggal
  // cukup tampil sekali di subjudul biar sumbu-X nggak penuh.
  const multiDay = hasData && new Date(tMin).toDateString() !== new Date(tMax).toDateString();
  const dataRangeLabel = hasData
    ? multiDay
      ? `${fmtDay(tMin)} ${fmtClock(tMin)} – ${fmtDay(tMax)} ${fmtClock(tMax)}`
      : `${new Date(tMin).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} • ${fmtClock(tMin)} – ${fmtClock(tMax)}`
    : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!hasData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverX(((e.clientX - rect.left) / rect.width) * W);
  }

  // Untuk crosshair: titik terdekat tiap seri pada x kursor
  const hoverPoints = useMemo(() => {
    if (hoverX == null) return [];
    return series.map((s) => {
      if (s.points.length === 0) return null;
      let best = s.points[0], bestD = Infinity;
      for (const p of s.points) {
        const d = Math.abs(sx(p.t) - hoverX);
        if (d < bestD) { bestD = d; best = p; }
      }
      return { name: s.name, color: s.color, p: best };
    }).filter(Boolean) as { name: string; color: string; p: { t: number; v: number } }[];
  }, [hoverX, series]);

  return (
    <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary, #111)" }}>{title}</h3>
        {/* legend */}
        <div style={{ display: "flex", gap: 14 }}>
          {series.map((s) => (
            <span key={s.name} style={{ fontSize: 12, color: "var(--text-secondary, #555)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 12, height: 3, borderRadius: 2, background: s.color, display: "inline-block" }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      {dataRangeLabel && (
        <div style={{ fontSize: 12, color: "var(--text-secondary, #555)", marginBottom: 4 }}>
          {dataRangeLabel}
          {rangeLabel && <span style={{ color: "var(--text-tertiary, #888)" }}> · filter: {rangeLabel}</span>}
        </div>
      )}
      {hint && <div style={{ fontSize: 11, color: "var(--text-tertiary, #888)", fontStyle: "italic", marginBottom: 6 }}>{hint}</div>}

      <div style={{ position: "relative", width: "100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", cursor: hasData ? "crosshair" : "default" }}
          onMouseMove={onMove} onMouseLeave={() => setHoverX(null)} role="img" aria-label={`Grafik perbandingan ${title}`}>
          {gridY.map((g, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="var(--border-color, #eef0ee)" strokeWidth={1} />
              <text x={PAD.l - 8} y={g.y + 3} textAnchor="end" fontSize={10} fill="var(--text-tertiary, #999)">{g.v.toFixed(decimals)}</text>
            </g>
          ))}
          {xTicks.map((tk, i) => {
            const anchor = i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle";
            return (
              <g key={i}>
                {multiDay && (
                  <text x={tk.x} y={H - 20} textAnchor={anchor} fontSize={10} fontWeight={600} fill="var(--text-secondary, #666)">{fmtDay(tk.t)}</text>
                )}
                <text x={tk.x} y={H - 8} textAnchor={anchor} fontSize={10} fill="var(--text-tertiary, #999)">{fmtClock(tk.t)}</text>
              </g>
            );
          })}

          {series.map((s) => s.points.length >= 2 && (
            <polyline key={s.name} points={s.points.map((p) => `${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {hoverX != null && hoverPoints.length > 0 && (
            <>
              <line x1={hoverX} y1={PAD.t} x2={hoverX} y2={H - PAD.b} stroke="var(--text-tertiary, #999)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
              {hoverPoints.map((h) => (
                <circle key={h.name} cx={sx(h.p.t)} cy={sy(h.p.v)} r={4.5} fill={h.color} stroke="#fff" strokeWidth={1.5} />
              ))}
            </>
          )}

          {!hasData && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--text-tertiary, #999)">Belum ada data</text>}
        </svg>

        {hoverX != null && hoverPoints.length > 0 && (
          <div style={{ position: "absolute", left: `${(hoverX / W) * 100}%`, top: 0, transform: "translate(-50%, -4px)", background: "var(--text-primary, #1a1a1a)", color: "#fff", fontSize: 11, lineHeight: 1.5, padding: "6px 9px", borderRadius: 7, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}>
            <div style={{ opacity: 0.7, marginBottom: 2 }}>{fmtFull(hoverPoints[0].p.t)}</div>
            {hoverPoints.map((h) => (
              <div key={h.name}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: h.color, marginRight: 5 }} />
                {h.name}: <strong>{h.p.v.toFixed(decimals)} {unit}</strong>
                {/* titik terdekat tiap seri bisa beda waktu → tampilkan kalau meleset */}
                {h.p.t !== hoverPoints[0].p.t && <span style={{ opacity: 0.6 }}> ({fmtFull(h.p.t)})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
