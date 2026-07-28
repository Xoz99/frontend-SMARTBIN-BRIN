"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

// Warna per kelas (samain dgn palet app).
const COLOR: Record<string, string> = {
  Organik: "#48846C",
  Anorganik: "#5b7c99",
  B3: "#c25a5e",
};

/**
 * Deteksi jenis sampah pakai KAMERA DEVICE admin (webcam laptop/HP).
 * Frame dikirim ke service inference publik di VPS (POST {API_BASE}/predict,
 * EfficientNet TFLite). Hasil ditampilkan; dikaitkan ke bin (nodeId) untuk
 * langkah remote/aktuasi berikutnya.
 */
export default function CameraDetect({ nodeId }: { nodeId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kategori: string; confidence: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Matikan kamera saat komponen di-unmount (drawer ditutup).
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setOn(true);
    } catch {
      setErr("Gagal akses kamera. Pastikan izin kamera diberikan (butuh HTTPS).");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
  }

  async function detect() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const v = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      canvas.getContext("2d")!.drawImage(v, 0, 0, 640, 640);
      const blob: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.85),
      );
      const fd = new FormData();
      fd.append("file", blob, "capture.jpg");
      const r = await fetch(`${API_BASE}/predict`, { method: "POST", body: fd });
      const data = await r.json();
      if (data.status === "success") {
        setResult({ kategori: data.kategori, confidence: data.confidence });
      } else {
        setErr(data.message || "Deteksi gagal.");
      }
    } catch {
      setErr("Gagal konek ke server inference.");
    } finally {
      setBusy(false);
    }
  }

  const conf = result ? Math.round(result.confidence * 100) : 0;
  const color = result ? COLOR[result.kategori] ?? "#c79a4a" : "#888";

  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary, #555)", margin: "10px 2px 8px" }}>
        Deteksi Jenis Sampah (Kamera) • {nodeId}
      </div>

      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 320, margin: "0 auto", borderRadius: 12, overflow: "hidden", background: "#000", border: "1px solid var(--border-color, #eef0ee)" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: on ? "block" : "none" }} />
        {!on && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13 }}>
            Kamera mati
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
        {!on ? (
          <button type="button" onClick={start} style={btn("#48846C", true)}>Buka Kamera</button>
        ) : (
          <>
            <button type="button" onClick={detect} disabled={busy} style={btn("#48846C", true)}>
              {busy ? "Menganalisis…" : "Deteksi"}
            </button>
            <button type="button" onClick={stop} style={btn("#c25a5e", false)}>Tutup</button>
          </>
        )}
      </div>

      {err && <p style={{ fontSize: 12, color: "var(--color-red, #c25a5e)", textAlign: "center", marginTop: 8 }}>{err}</p>}

      {result && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-color, #eef0ee)", background: "var(--surface-alt, #f7f9f8)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary, #111)" }}>{result.kategori}</span>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-secondary, #555)" }}>{conf}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--border-color, #e5e7eb)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${conf}%`, background: color }} />
          </div>
        </div>
      )}
    </div>
  );
}

function btn(color: string, filled: boolean): React.CSSProperties {
  return {
    fontSize: 13, fontWeight: 600, borderRadius: 8, padding: "8px 18px", cursor: "pointer",
    border: `1px solid ${color}`,
    color: filled ? "#fff" : color,
    background: filled ? color : "transparent",
  };
}
