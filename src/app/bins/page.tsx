"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  TrashIcon, PlusIcon, PencilSimpleIcon, MapPinIcon, XIcon, CircleNotchIcon, FloppyDiskIcon, ShieldWarningIcon, StackIcon, CheckIcon, MagnifyingGlassIcon,
  ScalesIcon, WindIcon, BatteryMediumIcon, GaugeIcon, WifiHighIcon, WifiSlashIcon, ClockIcon, ArrowSquareOutIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import type { Area, Bin, SensorReading } from "@/lib/types";
import { binVolume, binStatus, STATUS_LABEL, latestReading, timeAgo, liveBattery, formatWeight } from "@/lib/binStatus";
import styles from "./page.module.css";

interface FormState {
  nodeId: string;
  location: string;
  lat: string;
  lng: string;
  areaId: string;
}

const EMPTY_FORM: FormState = { nodeId: "", location: "", lat: "", lng: "", areaId: "" };

export default function BinsPage() {
  const { user, loading: authLoading } = useAuth();
  const [bins, setBins] = useState<Bin[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  // Modal form
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bin | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal kelola area
  const [areaOpen, setAreaOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [editAreaId, setEditAreaId] = useState<string | null>(null);
  const [editAreaName, setEditAreaName] = useState("");
  const [areaBusy, setAreaBusy] = useState(false);
  const [areaError, setAreaError] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  // Detail bin (tetap segar setelah reload karena dicari ulang dari state).
  const detailBin = detailId ? bins.find((b) => b.id === detailId) ?? null : null;

  const q = query.trim().toLowerCase();
  const filteredBins = q
    ? bins.filter((b) =>
        b.nodeId.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        (b.area?.name ?? "").toLowerCase().includes(q),
      )
    : bins;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [binsData, areasData] = await Promise.all([
        api.getBins(),
        api.getAreas().catch(() => [] as Area[]), // PETUGAS bisa 403 — abaikan
      ]);
      setBins(binsData);
      setAreas(areasData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime via WebSocket: setiap paket sensor (BIN_UPDATE) langsung memperbarui
  // bacaan `latest` bin terkait — nilai berat/volume/baterai/RSSI & status online
  // ikut segar tanpa reload. BIN_STATUS memperbarui online/offline.
  useRealtime((event, payload) => {
    if (event === "BIN_UPDATE") {
      const binId = payload.binId as string | undefined;
      const nodeId = payload.nodeId as string | undefined;
      const reading: SensorReading = {
        weight: (payload.weight as number) ?? null,
        weightRaw: (payload.weightRaw as number) ?? null,
        volume: (payload.volume as number) ?? null,
        battery: (payload.battery as number) ?? null,
        batteryVoltage: (payload.batteryVoltage as number) ?? null,
        compartments: (payload.compartments as SensorReading["compartments"]) ?? null,
        gas: (payload.gas as number) ?? null,
        rssi: (payload.rssi as number) ?? null,
        snr: (payload.snr as number) ?? null,
        packetLen: (payload.packetLen as number) ?? null,
        createdAt: (payload.timestamp as string) ?? new Date().toISOString(),
      };
      setBins((prev) => prev.map((b) =>
        (binId && b.id === binId) || (nodeId && b.nodeId === nodeId)
          ? { ...b, latest: reading, lastSeen: reading.createdAt ?? null, status: "online" }
          : b,
      ));
    } else if (event === "BIN_STATUS") {
      const binId = payload.binId as string | undefined;
      const nodeId = payload.nodeId as string | undefined;
      const status = payload.status as ("online" | "offline") | undefined;
      if (!status) return;
      setBins((prev) => prev.map((b) =>
        (binId && b.id === binId) || (nodeId && b.nodeId === nodeId) ? { ...b, status } : b,
      ));
    }
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (bin: Bin) => {
    setEditing(bin);
    setForm({
      nodeId: bin.nodeId,
      location: bin.location,
      lat: String(bin.lat),
      lng: String(bin.lng),
      areaId: bin.areaId ?? "",
    });
    setFormError(null);
    setOpen(true);
  };

  const close = () => { if (!saving) setOpen(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (form.nodeId.trim().length < 1) return setFormError("Node ID wajib diisi.");
    if (form.location.trim().length < 3) return setFormError("Lokasi minimal 3 karakter.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setFormError("Latitude & longitude harus angka.");

    setSaving(true);
    try {
      const payload = {
        nodeId: form.nodeId.trim(),
        location: form.location.trim(),
        lat,
        lng,
        areaId: form.areaId || null,
      };
      if (editing) await api.updateBin(editing.id, payload);
      else await api.createBin(payload);
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Gagal menyimpan bin.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (bin: Bin) => {
    if (!confirm(`Hapus bin "${bin.nodeId}" (${bin.location})? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api.deleteBin(bin.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Gagal menghapus bin.");
    }
  };

  // ── Area handlers ──────────────────────────────────────────────────
  const openAreas = () => {
    setNewAreaName("");
    setEditAreaId(null);
    setEditAreaName("");
    setAreaError(null);
    setAreaOpen(true);
  };

  const addArea = async () => {
    const name = newAreaName.trim();
    if (name.length < 3) return setAreaError("Nama area minimal 3 karakter.");
    setAreaBusy(true);
    setAreaError(null);
    try {
      await api.createArea(name);
      setNewAreaName("");
      await load();
    } catch (e) {
      setAreaError(e instanceof ApiError ? e.message : "Gagal menambah area.");
    } finally {
      setAreaBusy(false);
    }
  };

  const saveArea = async (id: string) => {
    const name = editAreaName.trim();
    if (name.length < 3) return setAreaError("Nama area minimal 3 karakter.");
    setAreaBusy(true);
    setAreaError(null);
    try {
      await api.updateArea(id, name);
      setEditAreaId(null);
      await load();
    } catch (e) {
      setAreaError(e instanceof ApiError ? e.message : "Gagal mengubah area.");
    } finally {
      setAreaBusy(false);
    }
  };

  const removeArea = async (area: Area) => {
    if (!confirm(`Hapus area "${area.name}"?`)) return;
    setAreaError(null);
    try {
      await api.deleteArea(area.id);
      await load();
    } catch (e) {
      setAreaError(e instanceof ApiError ? e.message : "Gagal menghapus area.");
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Manajemen Bin</h1>
          <p>Kelola tong sampah pintar — tambah, ubah lokasi, atau hapus perangkat.</p>
        </div>
        {isAdmin && (
          <div className={styles.headerActions}>
            <button className={styles.secondaryBtn} onClick={openAreas}>
              <StackIcon size={18} weight="duotone" /> Kelola Area
            </button>
            <button className={styles.primaryBtn} onClick={openCreate}>
              <PlusIcon size={18} weight="bold" /> Tambah Bin
            </button>
          </div>
        )}
      </header>

      {!authLoading && !isAdmin && (
        <div className={styles.noticeBanner}>
          <ShieldWarningIcon size={18} weight="fill" /> Mode lihat-saja. Hanya Admin yang bisa menambah, mengubah, atau menghapus bin.
        </div>
      )}

      {error && <div className={styles.errorBanner}>⚠ {error} <button onClick={load}>Coba lagi</button></div>}

      {/* Search */}
      <div className={styles.searchBar}>
        <MagnifyingGlassIcon size={18} weight="bold" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari bin — Node ID, lokasi, atau area…"
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery("")} title="Bersihkan">
            <XIcon size={16} />
          </button>
        )}
        <span className={styles.searchCount}>{filteredBins.length} dari {bins.length} bin</span>
      </div>

      {/* Grid kartu bin */}
      {loading ? (
        <div className={styles.stateBox}>Memuat…</div>
      ) : bins.length === 0 ? (
        <div className={styles.stateBox}>Belum ada bin terdaftar.</div>
      ) : filteredBins.length === 0 ? (
        <div className={styles.stateBox}>Tidak ada bin yang cocok dengan &quot;{query}&quot;.</div>
      ) : (
        <div className={styles.binGrid}>
          {filteredBins.map((bin) => {
            const vol = binVolume(bin);
            const status = binStatus(bin);
            const r = latestReading(bin);
            const online = bin.status === "online";
            return (
              <article key={bin.id} className={`${styles.binCard} ${styles[status]}`} onClick={() => setDetailId(bin.id)}>
                <div className={styles.cardTop}>
                  <span className={styles.cardId}>
                    <span className={`${styles.statusDot} ${styles[status]}`} /> {bin.nodeId}
                  </span>
                  {isAdmin && (
                    <span className={styles.cardActions}>
                      <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); openEdit(bin); }} title="Ubah">
                        <PencilSimpleIcon size={15} />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={(e) => { e.stopPropagation(); remove(bin); }} title="Hapus">
                        <TrashIcon size={15} />
                      </button>
                    </span>
                  )}
                </div>

                <span className={styles.cardLoc}>
                  <MapPinIcon size={13} weight="fill" color="#48846c" /> {bin.location}
                </span>

                <div className={styles.cardCap}>
                  <div className={styles.cardCapHead}>
                    <span className={`${styles.statusPill} ${styles[status]}`}>{STATUS_LABEL[status]}</span>
                    <span className={styles.cardPct}>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                  </div>
                  <div className={styles.capBar}>
                    <div className={`${styles.capFill} ${styles[status]}`} style={{ width: `${vol ?? 0}%` }} />
                  </div>
                </div>

                <div className={styles.cardMeta}>
                  <span className={styles.cardMetaItem}>
                    <ScalesIcon size={14} weight="duotone" color="#48846c" />{formatWeight(r?.weightRaw) ?? "–"}
                  </span>
                  <span className={styles.cardMetaItem}>
                    <BatteryMediumIcon size={14} weight="duotone" color="#c79a4a" />{liveBattery(bin) != null ? `${Math.round(liveBattery(bin)!)}%` : "–"}
                  </span>
                  <span className={styles.cardMetaItem}>
                    {online ? <WifiHighIcon size={14} weight="bold" color="#48846c" /> : <WifiSlashIcon size={14} weight="bold" color="#9ea5ad" />}
                    {online ? "Online" : "Offline"}
                  </span>
                </div>

                <div className={styles.cardFoot}>
                  <span className={styles.cardArea}>{bin.area?.name ?? "Tanpa area"}</span>
                  <span className={styles.cardTime}>
                    <ClockIcon size={12} weight="regular" /> {timeAgo(r?.timestamp ?? r?.createdAt)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal tambah/edit */}
      {open && (
        <div className={styles.overlay} onClick={close}>
          <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className={styles.modalHead}>
              <h2>{editing ? "Ubah Bin" : "Tambah Bin"}</h2>
              <button type="button" className={styles.closeBtn} onClick={close}><XIcon size={18} /></button>
            </div>

            {formError && <div className={styles.errorBanner}>⚠ {formError}</div>}

            <label className={styles.field}>
              <span>Node ID</span>
              <input
                value={form.nodeId}
                onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
                placeholder="bin-001"
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span>Lokasi</span>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Taman Kota, Blok A"
              />
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span>Latitude</span>
                <input
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  placeholder="-6.2088"
                  inputMode="decimal"
                />
              </label>
              <label className={styles.field}>
                <span>Longitude</span>
                <input
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  placeholder="106.8456"
                  inputMode="decimal"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Area <span className={styles.optional}>(opsional)</span></span>
              <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                <option value="">— Tanpa area —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={close} disabled={saving}>Batal</button>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                {saving ? <><CircleNotchIcon size={18} weight="bold" className={styles.spin} /> Menyimpan…</> : <><FloppyDiskIcon size={18} weight="fill" /> Simpan</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal kelola area */}
      {areaOpen && (
        <div className={styles.overlay} onClick={() => !areaBusy && setAreaOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Kelola Area</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setAreaOpen(false)}><XIcon size={18} /></button>
            </div>

            {areaError && <div className={styles.errorBanner}>⚠ {areaError}</div>}

            {/* Tambah area baru */}
            <div className={styles.areaAddRow}>
              <input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }}
                placeholder="Nama area baru…"
              />
              <button className={styles.primaryBtn} onClick={addArea} disabled={areaBusy}>
                {areaBusy ? <CircleNotchIcon size={18} weight="bold" className={styles.spin} /> : <PlusIcon size={18} weight="bold" />} Tambah
              </button>
            </div>

            {/* Daftar area */}
            <div className={styles.areaList}>
              {areas.length === 0 && <div className={styles.areaEmpty}>Belum ada area.</div>}
              {areas.map((a) => (
                <div key={a.id} className={styles.areaItem}>
                  {editAreaId === a.id ? (
                    <>
                      <input
                        className={styles.areaEditInput}
                        value={editAreaName}
                        onChange={(e) => setEditAreaName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveArea(a.id); } }}
                        autoFocus
                      />
                      <button className={styles.iconBtn} onClick={() => saveArea(a.id)} disabled={areaBusy} title="Simpan"><CheckIcon size={16} weight="bold" /></button>
                      <button className={styles.iconBtn} onClick={() => setEditAreaId(null)} title="Batal"><XIcon size={16} /></button>
                    </>
                  ) : (
                    <>
                      <span className={styles.areaName}>{a.name}</span>
                      <span className={styles.areaCount}>{a._count?.bins ?? 0} bin</span>
                      <button className={styles.iconBtn} onClick={() => { setEditAreaId(a.id); setEditAreaName(a.name); setAreaError(null); }} title="Ubah"><PencilSimpleIcon size={16} /></button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => removeArea(a)} title="Hapus"><TrashIcon size={16} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drawer detail bin */}
      {detailBin && (() => {
        const r = latestReading(detailBin);
        const vol = binVolume(detailBin);
        const status = binStatus(detailBin);
        const online = detailBin.status === "online";
        return (
          <div className={styles.drawerOverlay} onClick={() => setDetailId(null)}>
            <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className={styles.drawerHead}>
                <div>
                  <div className={styles.drawerNode}>{detailBin.nodeId}</div>
                  <div className={styles.drawerLoc}><MapPinIcon size={14} weight="fill" color="#48846c" /> {detailBin.location}</div>
                </div>
                <button className={styles.closeBtn} onClick={() => setDetailId(null)}><XIcon size={18} /></button>
              </div>

              {/* Status + koneksi */}
              <div className={styles.drawerBadges}>
                <span className={`${styles.statusPill} ${styles[status]}`}>{STATUS_LABEL[status]}</span>
                <span className={`${styles.connPill} ${online ? styles.online : styles.offline}`}>
                  {online ? <WifiHighIcon size={13} weight="bold" /> : <WifiSlashIcon size={13} weight="bold" />} {online ? "Online" : "Offline"}
                </span>
                <span className={styles.drawerUpdated}>
                  <ClockIcon size={13} weight="regular" /> {timeAgo(r?.timestamp ?? r?.createdAt)}
                </span>
              </div>

              {/* Kapasitas */}
              <div className={styles.capBlock}>
                <div className={styles.capHead}>
                  <span>Kapasitas terisi</span>
                  <span className={styles.capPct}>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                </div>
                <div className={styles.capBar}>
                  <div className={`${styles.capFill} ${styles[status]}`} style={{ width: `${vol ?? 0}%` }} />
                </div>
              </div>

              {/* Metric cards */}
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><ScalesIcon size={15} weight="duotone" color="#48846c" /> Berat</span>
                  <span className={styles.metricValue}>{formatWeight(r?.weightRaw) ?? "–"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><WindIcon size={15} weight="duotone" color="#5b7c99" /> Gas</span>
                  <span className={styles.metricValue}>{r?.gas != null ? r.gas : "–"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><BatteryMediumIcon size={15} weight="duotone" color="#c79a4a" /> Baterai</span>
                  <span className={styles.metricValue}>{liveBattery(detailBin) != null ? `${Math.round(liveBattery(detailBin)!)}%` : "–"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><GaugeIcon size={15} weight="duotone" color="#48846c" /> Volume</span>
                  <span className={styles.metricValue}>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                </div>
              </div>

              {/* Kompartemen EcoSort (per jenis sampah) — tampil hanya kalau ada datanya */}
              {r?.compartments && (
                <div style={{ marginTop: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary, #555)", margin: "10px 2px 8px" }}>
                    Kompartemen (EcoSort)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {([
                      { key: "organik", name: "Organik", color: "#48846C" },
                      { key: "anorganik", name: "Anorganik", color: "#5b7c99" },
                      { key: "b3", name: "B3", color: "#c25a5e" },
                    ] as const).map(({ key, name, color }) => {
                      const c = r.compartments?.[key];
                      const cvol = c?.volume ?? 0;
                      return (
                        <div key={key} style={{ border: "1px solid var(--border-color, #eef0ee)", borderRadius: 12, padding: "10px 12px", background: "var(--surface-alt, #f7f9f8)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />
                            <span style={{ fontSize: 12, color: "var(--text-secondary, #555)" }}>{name}</span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #111)", lineHeight: 1 }}>{Math.round(cvol)}%</div>
                          <div style={{ height: 5, borderRadius: 999, background: "var(--border-color, #e5e7eb)", marginTop: 8, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${cvol}%`, background: color }} />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary, #888)", marginTop: 6 }}>
                            {c?.distance != null ? `${c.distance.toFixed(1)} cm` : "kosong"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Info detail */}
              <div className={styles.infoList}>
                {r?.batteryVoltage != null && (
                  <div className={styles.infoRow}><span>Tegangan baterai</span><strong>{r.batteryVoltage.toFixed(2)} V</strong></div>
                )}
                <div className={styles.infoRow}><span>Area</span><strong>{detailBin.area?.name ?? "—"}</strong></div>
                <div className={styles.infoRow}>
                  <span>Koordinat</span>
                  <a
                    className={styles.mapLink}
                    href={`https://www.google.com/maps/search/?api=1&query=${detailBin.lat},${detailBin.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Buka di Google Maps"
                  >
                    {Number(detailBin.lat).toFixed(5)}, {Number(detailBin.lng).toFixed(5)}
                    <ArrowSquareOutIcon size={14} weight="bold" />
                  </a>
                </div>
                <div className={styles.infoRow}><span>Ambang volume</span><strong>{detailBin.volumeThreshold ?? 80}%</strong></div>
                <div className={styles.infoRow}><span>Ambang berat</span><strong>{detailBin.weightThreshold != null ? `${detailBin.weightThreshold} kg` : "—"}</strong></div>
                <div className={styles.infoRow}><span>Ambang gas</span><strong>{detailBin.gasThreshold ?? "—"}</strong></div>
                <div className={styles.infoRow}><span>Ambang baterai</span><strong>{detailBin.batteryThreshold != null ? `${detailBin.batteryThreshold}%` : "—"}</strong></div>
              </div>

              {/* Aksi */}
              {isAdmin && (
                <div className={styles.drawerActions}>
                  <button className={styles.secondaryBtn} onClick={() => { setDetailId(null); openEdit(detailBin); }}>
                    <PencilSimpleIcon size={16} /> Ubah
                  </button>
                  <button className={`${styles.secondaryBtn} ${styles.dangerBtn}`} onClick={() => { setDetailId(null); remove(detailBin); }}>
                    <TrashIcon size={16} /> Hapus
                  </button>
                </div>
              )}
            </aside>
          </div>
        );
      })()}
    </div>
  );
}
