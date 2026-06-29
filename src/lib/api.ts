// Klien REST tipis untuk backend SmartBIN.
// - Base URL dari NEXT_PUBLIC_API_URL (default http://localhost:3000)
// - Menyisipkan header Authorization: Bearer <token> dari localStorage
// - Membongkar amplop { success, message, data } dan melempar ApiError saat gagal

import type {
  Alert,
  Area,
  Bin,
  ClassificationSummary,
  Deposit,
  Pagination,
  Pickup,
  PickupStatus,
  User,
  WasteLabel,
  WeeklyVolumePoint,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3000";

const TOKEN_KEY = "smartbin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; pagination?: Pagination }> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      "Tidak bisa terhubung ke server. Pastikan backend berjalan di " + API_BASE,
      0,
    );
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    /* respons bukan JSON */
  }

  if (!res.ok || (body && body.success === false)) {
    const message = body?.message || `Request gagal (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return { data: (body?.data as T) ?? (null as T), pagination: body?.pagination };
}

// ── Auth ──────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const { data } = await request<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data;
}

export async function getMe() {
  const { data } = await request<User>("/auth/me");
  return data;
}

// ── Bins ──────────────────────────────────────────────────────────────
export async function getBins() {
  const { data } = await request<Bin[]>("/bins");
  return data ?? [];
}

export async function getBin(id: string) {
  const { data } = await request<Bin>(`/bins/${id}`);
  return data;
}

// CRUD bin (ADMIN). createAt/updateAt mengembalikan objek bin.
export async function createBin(input: {
  nodeId: string;
  location: string;
  lat: number;
  lng: number;
  areaId?: string | null;
}) {
  const { data } = await request<Bin>("/bins", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

export async function updateBin(
  id: string,
  input: Partial<{ nodeId: string; location: string; lat: number; lng: number; areaId: string | null }>,
) {
  const { data } = await request<Bin>(`/bins/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data;
}

export async function deleteBin(id: string) {
  await request<null>(`/bins/${id}`, { method: "DELETE" });
}

export async function getOptimalRoute(lat: number, lng: number) {
  const { data } = await request<{
    route: Array<Bin & { distanceFromPreviousKm: number; alerts: Alert[] }>;
    googleMapsUrl: string | null;
    qrCodeBase64?: string;
    message?: string;
  }>(`/bins/route/optimal?lat=${lat}&lng=${lng}`);
  return data;
}

// ── Alerts ────────────────────────────────────────────────────────────
export async function getAlerts(params: {
  resolved?: boolean;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.resolved !== undefined) q.set("resolved", String(params.resolved));
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.page) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 50));
  const { data, pagination } = await request<Alert[]>(`/alerts?${q.toString()}`);
  return { alerts: data ?? [], pagination };
}

export async function resolveAlert(id: string) {
  const { data } = await request<Alert>(`/alerts/${id}/resolve`, { method: "PUT" });
  return data;
}

// ── Pickups ───────────────────────────────────────────────────────────
export async function getPickups(params: {
  status?: PickupStatus;
  binId?: string;
  page?: number;
  limit?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.binId) q.set("binId", params.binId);
  if (params.page) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 50));
  const { data, pagination } = await request<Pickup[]>(`/pickups?${q.toString()}`);
  return { pickups: data ?? [], pagination };
}

export async function completePickup(binId: string, coords?: { lat: number; lng: number }) {
  const { data } = await request<Pickup>(`/pickups/${binId}/complete`, {
    method: "POST",
    body: JSON.stringify(coords ?? {}),
  });
  return data;
}

// ── Areas (ADMIN) ─────────────────────────────────────────────────────
export async function getAreas() {
  const { data } = await request<Area[]>("/areas");
  return data ?? [];
}

export async function createArea(name: string) {
  const { data } = await request<Area>("/areas", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data;
}

export async function updateArea(id: string, name: string) {
  const { data } = await request<Area>(`/areas/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
  return data;
}

export async function deleteArea(id: string) {
  await request<null>(`/areas/${id}`, { method: "DELETE" });
}

// ── Deposits / Pemilahan sampah ───────────────────────────────────────
// Histori setoran (hasil pemilah otomatis & scan warga).
export async function getDeposits(params: { binId?: string; nodeId?: string; from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.binId) q.set("binId", params.binId);
  if (params.nodeId) q.set("nodeId", params.nodeId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  const { data } = await request<Deposit[]>(`/deposits${qs ? `?${qs}` : ""}`);
  return data ?? [];
}

// Catat satu hasil pemilahan. Dipakai juga oleh raspi-pemilah:
// backend menyimpan + mengirim perintah MQTT { action:'sort', label } ke bin.
export async function createDeposit(input: {
  nodeId: string;
  label: WasteLabel;
  confidence?: number;
  weight?: number;
}) {
  const { data } = await request<Deposit>("/deposits", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

// ── Settings ──────────────────────────────────────────────────────────
// Setelan operasional global. Saat ini hanya pickupThreshold (% ambang
// "Perlu Diangkut", disimpan di Redis backend).
export async function getSettings() {
  const { data } = await request<{ pickupThreshold: number }>("/settings");
  return data;
}

export async function setPickupThreshold(value: number) {
  const { data } = await request<{ pickupThreshold: number }>(
    "/settings/pickup-threshold",
    { method: "PUT", body: JSON.stringify({ value }) },
  );
  return data;
}

// ── Analytics ─────────────────────────────────────────────────────────
export async function getWeeklyVolume(params: { from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  const { data } = await request<WeeklyVolumePoint[]>(`/analytics/weekly-volume${qs ? `?${qs}` : ""}`);
  return data ?? [];
}

// Agregasi jenis sampah dari pemilah otomatis (tabel classifications).
// Endpoint ini MENYUSUL di backend — pemanggil harus menangani ApiError 404
// dan fallback ke agregasi /deposits. Lihat BACKEND-TODO-pemilah.md.
export async function getClassificationSummary(params: { from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  const { data } = await request<ClassificationSummary>(
    `/classifications/summary${qs ? `?${qs}` : ""}`,
  );
  return data;
}
