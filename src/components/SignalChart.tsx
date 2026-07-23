"use client";

// Grafik garis time-series untuk metrik link LoRa (RSSI / SNR / panjang paket).
// Single-series → tanpa legend (judul yang menamai seri). Garis 2px, grid resesif,
// crosshair + tooltip saat hover. Posisi tooltip pakai persentase viewBox supaya
// tetap presisi walau SVG di-scale responsif.

import React, { useMemo, useState } from "react";

export interface SignalPoint {
  t: number; // epoch ms
  v: number; // nilai metrik
}

interface SignalChartProps {
  title: string;
  unit: string;
  color: string;
  points: SignalPoint[]; // urut kronologis (lama → baru)
  decimals?: number;
  /** teks bantu di header, mis. "makin ke 0 makin bagus" untuk RSSI */
  hint?: string;
}

const W = 560;
const H = 200;
const PAD = { l: 46, r: 16, t: 14, b: 26 };

function niceStats(vals: number[]) {
  if (vals.length === 0) return { min: 0, max: 0, avg: 0 };
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of vals) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  return { min, max, avg: sum / vals.length };
}

export default function SignalChart({ title, unit, color, points, decimals = 0, hint }: SignalChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const { min, max, avg } = useMemo(() => niceStats(points.map((p) => p.v)), [points]);
  const current = points.length ? points[points.length - 1].v : null;

  // Skala Y dengan sedikit padding; kalau semua nilai sama, lebarkan supaya garis tak nempel tepi.
  const { yMin, yMax } = useMemo(() => {
    if (points.length === 0) return { yMin: 0, yMax: 1 };
    let lo = min, hi = max;
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    return { yMin: lo - pad, yMax: hi + pad };
  }, [points, min, max]);

  const tMin = points.length ? points[0].t : 0;
  const tMax = points.length ? points[points.length - 1].t : 1;
  const tSpan = Math.max(1, tMax - tMin);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + ((t - tMin) / tSpan) * plotW;
  const sy = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const linePts = points.map((p) => `${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join(" ");

  // 4 garis grid horizontal + label sumbu-Y
  const gridY = [0, 1, 2, 3].map((i) => {
    const v = yMax - (i / 3) * (yMax - yMin);
    return { v, y: sy(v) };
  });

  // beberapa tick waktu di sumbu-X
  const xTicks = points.length >= 2
    ? [0, 0.5, 1].map((f) => {
        const t = tMin + f * tSpan;
        return { t, x: PAD.l + f * plotW };
      })
    : [];

  const fmtTime = (t: number) =>
    new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W; // ke koordinat viewBox
    // cari titik terdekat berdasar x
    let best = 0, bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(sx(points[i].t) - px);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  }

  const hp = hover != null ? points[hover] : null;

  return (
    <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary, #111)" }}>
          <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: color, marginRight: 7 }} />
          {title}
        </h3>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)" }}>
          {current != null ? `${current.toFixed(decimals)}` : "–"}
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-tertiary, #888)", marginLeft: 3 }}>{unit}</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-tertiary, #888)", marginBottom: 8 }}>
        <span>min {points.length ? min.toFixed(decimals) : "–"}</span>
        <span>avg {points.length ? avg.toFixed(decimals) : "–"}</span>
        <span>max {points.length ? max.toFixed(decimals) : "–"}</span>
        <span>n {points.length}</span>
        {hint && <span style={{ marginLeft: "auto", fontStyle: "italic" }}>{hint}</span>}
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block", cursor: points.length ? "crosshair" : "default" }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`Grafik ${title} terhadap waktu`}
        >
          {/* grid + label Y */}
          {gridY.map((g, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="var(--border-color, #eef0ee)" strokeWidth={1} />
              <text x={PAD.l - 8} y={g.y + 3} textAnchor="end" fontSize={10} fill="var(--text-tertiary, #999)">
                {g.v.toFixed(decimals)}
              </text>
            </g>
          ))}
          {/* tick waktu X */}
          {xTicks.map((tk, i) => (
            <text key={i} x={tk.x} y={H - 8} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} fontSize={10} fill="var(--text-tertiary, #999)">
              {fmtTime(tk.t)}
            </text>
          ))}

          {points.length >= 2 && (
            <polyline points={linePts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {/* titik data kecil kalau sedikit */}
          {points.length <= 30 && points.map((p, i) => (
            <circle key={i} cx={sx(p.t)} cy={sy(p.v)} r={2.5} fill={color} />
          ))}

          {/* crosshair + titik hover */}
          {hp && (
            <g>
              <line x1={sx(hp.t)} y1={PAD.t} x2={sx(hp.t)} y2={H - PAD.b} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <circle cx={sx(hp.t)} cy={sy(hp.v)} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
            </g>
          )}

          {points.length === 0 && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--text-tertiary, #999)">
              Belum ada data sinyal
            </text>
          )}
        </svg>

        {/* tooltip HTML — posisi persentase viewBox (presisi walau SVG di-scale) */}
        {hp && (
          <div
            style={{
              position: "absolute",
              left: `${(sx(hp.t) / W) * 100}%`,
              top: `${(sy(hp.v) / H) * 100}%`,
              transform: "translate(-50%, -125%)",
              background: "var(--text-primary, #1a1a1a)",
              color: "#fff",
              fontSize: 11,
              lineHeight: 1.4,
              padding: "5px 8px",
              borderRadius: 7,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            }}
          >
            <strong>{hp.v.toFixed(decimals)} {unit}</strong>
            <br />
            <span style={{ opacity: 0.75 }}>{fmtTime(hp.t)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
