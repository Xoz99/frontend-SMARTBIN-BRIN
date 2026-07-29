"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import * as api from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import type { WasteLabel } from "@/lib/types";

// Nama + warna per jenis (samain palet app).
const LABEL_META: Record<string, { name: string; color: string }> = {
  organik: { name: "Organik", color: "#48846C" },
  anorganik: { name: "Anorganik", color: "#5b7c99" },
  b3: { name: "B3", color: "#c25a5e" },
  unknown: { name: "Lainnya", color: "#c79a4a" },
};

interface Detection {
  label: WasteLabel;
  confidence: number;
  createdAt: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "baru saja";
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam lalu`;
}

/**
 * MONITOR kamera fisik Raspi (per bin) + HASIL DETEKSI terakhir.
 * - Feed: Pi push frame → backend; ambil /camera/{nodeId}/latest.jpg (refresh ~1.2s).
 * - Deteksi: jenis sampah yang terdeteksi & dieksekusi Pi (dari CLASSIFICATION_NEW,
 *   realtime) — ditampilkan sebagai overlay di feed.
 */
export default function RaspiCameraView({ nodeId, binId }: { nodeId: string; binId?: string }) {
  const [ts, setTs] = useState(() => Date.now());
  const [ok, setOk] = useState<boolean | null>(null);
  const [det, setDet] = useState<Detection | null>(null);
  const [flash, setFlash] = useState(false);

  // Refresh frame kamera.
  useEffect(() => {
    const id = setInterval(() => setTs(Date.now()), 1200);
    return () => clearInterval(id);
  }, []);

  // Ambil deteksi terakhir saat buka (biar nggak kosong sebelum ada event baru).
  useEffect(() => {
    if (!binId) return;
    let active = true;
    (async () => {
      try {
        const rows = await api.getClassifications({ binId, limit: 1 });
        if (active && rows.length) {
          setDet({ label: rows[0].label, confidence: rows[0].confidence, createdAt: rows[0].createdAt });
        }
      } catch { /* endpoint belum ada / kosong → biarkan null */ }
    })();
    return () => { active = false; };
  }, [binId]);

  // Realtime: tiap Pi mendeteksi & eksekusi → update hasil + kilat highlight.
  useRealtime((event, payload) => {
    if (event !== "CLASSIFICATION_NEW") return;
    if ((payload.nodeId as string) !== nodeId) return;
    setDet({
      label: payload.label as WasteLabel,
      confidence: (payload.confidence as number) ?? 0,
      createdAt: (payload.createdAt as string) ?? new Date().toISOString(),
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  });

  const src = `${API_BASE}/camera/${encodeURIComponent(nodeId)}/latest.jpg?t=${ts}`;
  const meta = det ? LABEL_META[det.label] ?? LABEL_META.unknown : null;
  const conf = det ? Math.round(det.confidence * 100) : 0;

  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 2px 8px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary, #555)" }}>
          Kamera Bin • {nodeId}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, marginLeft: "auto",
          color: ok ? "#48846C" : "var(--text-tertiary, #888)" }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: ok ? "#48846C" : "#c25a5e" }} />
          {ok === null ? "menghubungkan…" : ok ? "LIVE" : "offline"}
        </span>
      </div>

      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", background: "#000", border: "1px solid var(--border-color, #eef0ee)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Kamera ${nodeId}`}
          onLoad={() => setOk(true)}
          onError={() => setOk(false)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: ok ? "block" : "none" }}
        />
        {ok !== true && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#999", fontSize: 13 }}>
            <span style={{ fontSize: 26 }}>📷</span>
            {ok === null ? "Memuat kamera…" : "Kamera offline / belum ada frame"}
          </div>
        )}

        {/* Overlay hasil deteksi terakhir */}
        {det && meta && (
          <div style={{
            position: "absolute", left: 10, right: 10, bottom: 10,
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(0,0,0,0.62)", backdropFilter: "blur(3px)",
            borderRadius: 10, padding: "8px 11px",
            outline: flash ? `2px solid ${meta.color}` : "none",
            transition: "outline 0.2s ease",
          }}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: meta.color, flexShrink: 0,
              boxShadow: flash ? `0 0 8px ${meta.color}` : "none" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
                {meta.name} <span style={{ fontWeight: 600, color: "#e5e7eb", fontSize: 12 }}>· {conf}%</span>
              </div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                terdeteksi & dieksekusi · {timeAgo(det.createdAt)}
              </div>
            </div>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary, #888)", marginTop: 6 }}>
        Feed kamera Raspi + jenis sampah yang terdeteksi otomatis di perangkat.
      </p>
    </div>
  );
}
