"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * MONITOR kamera fisik Raspi (per bin). Pi push frame terakhir ke backend
 * (POST /camera/frame); komponen ini ambil /camera/{nodeId}/latest.jpg dan
 * refresh tiap ~1.2s (live-ish). Kalau tak ada frame (kamera mati/offline) → 404
 * → tampilkan status offline.
 */
export default function RaspiCameraView({ nodeId }: { nodeId: string }) {
  const [ts, setTs] = useState(() => Date.now());
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTs(Date.now()), 1200);
    return () => clearInterval(id);
  }, []);

  const src = `${API_BASE}/camera/${encodeURIComponent(nodeId)}/latest.jpg?t=${ts}`;

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
      </div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary, #888)", marginTop: 6 }}>
        Frame dari kamera Raspi (di-refresh otomatis). Deteksi jenis sampah tetap otomatis di perangkat.
      </p>
    </div>
  );
}
