// Logika turunan status bin yang dipakai konsisten di seluruh UI.
import type { Bin, SensorReading, StatusLevel } from "./types";

// Ambang batas default (saat bin belum punya threshold sendiri).
// Dashboard memakai konsep: Waspada > 75%, Kritis > 90%.
export const WARN_VOLUME = 75;
export const CRIT_VOLUME = 90;

// Bacaan terakhir bin: dari Redis (latest) bila online, jika tidak fallback
// ke log sensor terakhir yang tersimpan (sensorLogs[0]).
export function latestReading(bin: Bin): SensorReading | null {
  return bin.latest ?? bin.sensorLogs?.[0] ?? null;
}

export function binVolume(bin: Bin): number | null {
  const v = latestReading(bin)?.volume;
  return typeof v === "number" ? v : null;
}

// ── Sentinel / nilai "tidak ada pembacaan" dari firmware & backend ──────
// Firmware mengirim RSSI -999 saat sinyal belum terbaca; baterai bernilai
// tepat 0 (V) mustahil untuk node yang menyala, jadi keduanya diperlakukan
// sebagai "belum ada data" agar tidak tampil sebagai angka palsu.
export const RSSI_NO_DATA = -999;

export function cleanRssi(v: number | null | undefined): number | null {
  return typeof v === "number" && v !== RSSI_NO_DATA ? v : null;
}

// Format berat (kg dari hardware). < 1 kg tampil dalam gram biar mudah dibaca
// (0.2179 kg → "217.9 g"), selebihnya dalam kg. null bila tidak ada data.
export function formatWeight(v: number | null | undefined): string | null {
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  if (Math.abs(v) < 1) return `${(v * 1000).toFixed(1)} g`;
  return `${v.toFixed(2)} kg`;
}

// battery ditampilkan sebagai persen. Nilai ≤ 0 (device belum melapor)
// diperlakukan sebagai "belum ada data".
export function cleanBattery(v: number | null | undefined): number | null {
  return typeof v === "number" && v > 0 ? v : null;
}

// ── Kesegaran data (freshness / stale) ──────────────────────────────────
// Backend TIDAK mengirim flag "stale" atau "dataAgeSec"; kita turunkan sendiri
// dari timestamp bacaan terakhir. Bacaan lebih tua dari ambang ini dianggap
// basi, sehingga metrik "live" (mis. baterai) tidak ditampilkan sebagai nilai
// yang seolah-olah aktual padahal sudah usang.
export const STALE_AFTER_SEC = 15 * 60; // 15 menit

// Umur bacaan terakhir dalam detik (dari createdAt/timestamp). null bila tak ada.
export function readingAgeSec(bin: Bin): number | null {
  const r = latestReading(bin);
  const iso = r?.createdAt ?? r?.timestamp;
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.floor(ms / 1000));
}

// true bila tidak ada bacaan sama sekali atau bacaan lebih tua dari ambang.
export function isStale(bin: Bin, thresholdSec: number = STALE_AFTER_SEC): boolean {
  const age = readingAgeSec(bin);
  return age === null || age > thresholdSec;
}

// Baterai "live": hanya kalau bacaan tidak basi DAN nilainya valid (>0).
// Kembalikan null (→ UI tampil "–") saat data sudah usang, supaya angka
// baterai tidak menyesatkan.
export function liveBattery(bin: Bin): number | null {
  return isStale(bin) ? null : cleanBattery(latestReading(bin)?.battery);
}

// Label singkat umur data: "live" bila segar, "data 12 mnt lalu" bila basi.
export function freshnessLabel(bin: Bin): string {
  const age = readingAgeSec(bin);
  if (age === null) return "tidak ada data";
  if (age <= STALE_AFTER_SEC) return "live";
  return `data ${Math.round(age / 60)} mnt lalu`;
}

export function statusFromVolume(volume: number | null): StatusLevel {
  if (volume === null) return "unknown";
  if (volume >= CRIT_VOLUME) return "critical";
  if (volume >= WARN_VOLUME) return "warning";
  return "normal";
}

export function binStatus(bin: Bin): StatusLevel {
  return statusFromVolume(binVolume(bin));
}

export const STATUS_LABEL: Record<StatusLevel, string> = {
  normal: "Normal",
  warning: "Waspada",
  critical: "Kritis",
  unknown: "Tidak ada data",
};

// "2 menit yang lalu" dari sebuah timestamp ISO.
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit yang lalu`;
  const jam = Math.floor(min / 60);
  if (jam < 24) return `${jam} jam yang lalu`;
  const hari = Math.floor(jam / 24);
  return `${hari} hari yang lalu`;
}
