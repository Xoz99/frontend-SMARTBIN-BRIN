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
