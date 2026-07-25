// Tipe data yang mengikuti bentuk respons backend SmartBIN (lihat API_DOCS.md).

export type Role = "ADMIN" | "PETUGAS";

export interface Area {
  id: string;
  name: string;
  createdAt?: string;
  _count?: { bins: number; users: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  areaId: string | null;
  area?: Area | null;
  createdAt?: string;
}

// Satu kompartemen EcoSort (per jenis sampah): jarak laser + tingkat penuh.
export interface CompartmentReading {
  distance: number | null; // cm (null = out-of-range / kosong)
  volume: number | null;   // % penuh
}

export interface SensorReading {
  weight: number | null;
  // Berat timbangan live dari hardware (kg). weight = berat terkonfirmasi
  // (mode sensor_pairing) yang tetap 0 sampai ada setoran ter-pair; untuk
  // menampilkan bacaan timbangan aktual, pakai weightRaw.
  weightRaw?: number | null;
  volume: number | null;
  battery: number | null;
  batteryVoltage?: number | null; // V — tegangan pack baterai (EcoSort INA219)
  // Rincian per-kompartemen EcoSort (organik/anorganik/b3). null utk node non-EcoSort.
  compartments?: {
    organik?: CompartmentReading;
    anorganik?: CompartmentReading;
    b3?: CompartmentReading;
  } | null;
  gas: number | null;
  rssi: number | null;
  snr?: number | null; // dB — LoRa signal-to-noise ratio
  packetLen?: number | null; // bytes — panjang paket RF diterima
  transport?: "lora" | "http" | null; // jalur data sampai ke backend
  seq?: number | null; // nomor urut paket dari device (packet loss)
  latencyMs?: number | null; // ms — latency device→backend
  throughputBps?: number | null; // bit/detik — throughput jalur (diukur di gateway)
  timestamp?: string;
  createdAt?: string;
  logId?: string;
}

export interface Bin {
  id: string;
  nodeId: string;
  location: string;
  lat: number;
  lng: number;
  areaId: string | null;
  area?: Area | null;
  createdAt?: string;
  weightThreshold?: number | null;
  volumeThreshold?: number | null;
  gasThreshold?: number | null;
  batteryThreshold?: number | null;
  status?: "online" | "offline";
  lastSeen?: string | null;
  latest?: SensorReading | null;
  // Backend juga mengirim sensorLogs (riwayat terakhir) saat list /bins.
  sensorLogs?: SensorReading[];
}

export type AlertType = "FULL_WEIGHT" | "FULL_VOLUME" | "BATTERY_LOW" | "GAS_HIGH";

export interface Alert {
  id: string;
  binId: string;
  type: AlertType;
  message: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  areaId?: string | null;
  bin?: { nodeId: string; location: string };
}

export type PickupStatus = "MENUNGGU_SENSOR" | "SELESAI";

export interface Pickup {
  id: string;
  binId: string;
  petugasId: string;
  areaId: string | null;
  alertId: string | null;
  status: PickupStatus;
  completedAt: string | null;
  completedLat: number | null;
  completedLng: number | null;
  sensorConfirmedAt: string | null;
  createdAt: string;
  bin?: { nodeId: string; location: string; lat: number; lng: number };
  petugas?: { id: string; name: string; email: string };
}

export type WasteLabel = "organik" | "anorganik" | "b3" | "unknown";

// Setoran/hasil pemilahan sampah (dari pemilah otomatis atau scan warga).
export interface Deposit {
  id: string;
  userId: string;
  binId: string;
  label: WasteLabel;
  confidence: number | null;
  weight: number | null;
  createdAt: string;
  bin?: { nodeId: string; location: string };
  user?: { id: string; name: string };
}

// Satu deteksi klasifikasi (kamera/pemilah) — tiap objek yang terdeteksi.
// Beda dari Deposit: tercatat SETIAP deteksi (tanpa butuh pairing berat).
export interface Classification {
  id: string;
  binId: string;
  label: WasteLabel;
  confidence: number;
  createdAt: string;
  bin?: { nodeId: string; location: string };
}

// Titik data grafik volume mingguan (/analytics/weekly-volume).
export interface WeeklyVolumePoint {
  day: string; // "YYYY-MM-DD"
  totalKg: number;
}

// Agregasi jenis sampah dari pemilah (GET /classifications/summary).
export interface WasteLabelStat {
  label: WasteLabel;
  count: number;
  weightKg?: number;
  percentage: number;
}
export interface ClassificationSummary {
  total: number;
  totalWeightKg?: number;
  byLabel: WasteLabelStat[];
  mostCommon: WasteLabel | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Status visual berdasarkan volume (%). Dipakai konsisten di seluruh UI.
export type StatusLevel = "normal" | "warning" | "critical" | "unknown";
