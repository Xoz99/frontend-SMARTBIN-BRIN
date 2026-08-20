"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import * as api from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import { useAuth } from "@/context/AuthContext";
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
export default function RaspiCameraView({ nodeId, binId, roiFrac = 0.6 }: { nodeId: string; binId?: string; roiFrac?: number }) {
  const [ts, setTs] = useState(() => Date.now());
  const [ok, setOk] = useState<boolean | null>(null);
  const [det, setDet] = useState<Detection | null>(null);
  const [flash, setFlash] = useState(false);

  // Kontrol kamera Pi (remote lewat MQTT). null = belum tahu statusnya.
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [camOn, setCamOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [ctlMsg, setCtlMsg] = useState<string | null>(null);

  // Status awal kamera dari state retained (instan, nol beban ke Pi).
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    (async () => {
      try {
        const st = await api.getDeviceStatus(nodeId);
        if (active) setCamOn(st?.camera === "running");
      } catch {
        // 404 = Pi belum pernah lapor state (REMOTE_CONTROL=0 / belum konek).
        if (active) setCamOn(null);
      }
    })();
    return () => { active = false; };
  }, [nodeId, isAdmin]);

  async function toggleCam() {
    if (busy) return;
    setBusy(true);
    setCtlMsg(null);
    const nyalain = camOn !== true;
    try {
      let running = false;
      let devErr: string | null = null;
      if (nyalain) {
        const r = await api.startCamera(nodeId);
        running = !!r?.running;
        devErr = r?.error ?? null;
      } else {
        running = !!(await api.stopCamera(nodeId))?.running;
      }
      setCamOn(running);
      if (nyalain && !running) {
        // Pi jawab tapi kameranya gagal kebuka (mis. index salah / dipakai proses lain).
        setCtlMsg(devErr || "Kamera gagal dinyalakan di perangkat");
      } else {
        setCtlMsg(nyalain ? "Kamera dinyalakan" : "Kamera dimatikan");
        setTimeout(() => setCtlMsg(null), 2500);
      }
    } catch (e) {
      setCtlMsg(e instanceof Error ? e.message : "Perintah gagal dikirim");
    } finally {
      setBusy(false);
    }
  }

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
    if ((payload.nodeId as string) !== nodeId) return;
    // Pi ngirim snapshot state tiap ~15 dtk → status tombol ikut sinkron
    // walau kamera dinyalakan/dimatikan dari tempat lain (app, SSH).
    if (event === "DEVICE_STATE") {
      if (payload.online === false) setCamOn(false);
      else if (typeof payload.camera === "string") setCamOn(payload.camera === "running");
      return;
    }
    if (event !== "CLASSIFICATION_NEW") return;
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

        {/* Aktifkan/matikan kamera Pi dari jauh. ADMIN saja — backend juga
            mengunci endpoint-nya, ini cuma biar tombolnya tidak menipu. */}
        {isAdmin && (
          <button
            onClick={toggleCam}
            disabled={busy}
            title={camOn === null ? "Status kamera belum diketahui" : camOn ? "Matikan kamera Pi" : "Nyalakan kamera Pi"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
              cursor: busy ? "wait" : "pointer",
              border: `1px solid ${camOn ? "#c25a5e" : "#48846C"}`,
              background: camOn ? "transparent" : "#48846C",
              color: camOn ? "#c25a5e" : "#fff",
              opacity: busy ? 0.6 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {busy ? "…" : camOn ? "■ Matikan" : "▶ Aktifkan"} kamera
          </button>
        )}
      </div>

      {ctlMsg && (
        <p style={{ fontSize: 11, margin: "0 2px 8px", color: "var(--text-secondary, #555)" }}>
          {ctlMsg}
        </p>
      )}

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
            {ok === null
              ? "Memuat kamera…"
              : camOn === false
                ? "Kamera dimatikan" + (isAdmin ? " — tekan Aktifkan" : "")
                : "Kamera offline / belum ada frame"}
          </div>
        )}

        {/* Panduan AREA DETEKSI (ROI) — samain dgn ROI_FRAC di Pi. Posisiin kamera
            biar buletan merah pas di dalam kotak ini. */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          height: `${Math.round(roiFrac * 100)}%`, aspectRatio: "1 / 1",
          border: "2px dashed rgba(255,255,255,0.75)", borderRadius: 10, pointerEvents: "none",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.12)",
        }}>
          <span style={{ position: "absolute", top: -19, left: 0, fontSize: 10, fontWeight: 600,
            color: "#fff", background: "rgba(0,0,0,0.5)", padding: "1px 6px", borderRadius: 5, whiteSpace: "nowrap" }}>
            area deteksi
          </span>
        </div>

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
