"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Trash, Plus, PencilSimple, MapPin, X, CircleNotch, FloppyDisk, ShieldWarning, Stack, Check, MagnifyingGlass,
  Scales, Wind, BatteryMedium, Gauge, WifiHigh, WifiSlash, Clock,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { Area, Bin } from "@/lib/types";
import { binVolume, binStatus, STATUS_LABEL, latestReading, timeAgo } from "@/lib/binStatus";
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
  const { user } = useAuth();
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
              <Stack size={18} weight="duotone" /> Kelola Area
            </button>
            <button className={styles.primaryBtn} onClick={openCreate}>
              <Plus size={18} weight="bold" /> Tambah Bin
            </button>
          </div>
        )}
      </header>

      {!isAdmin && (
        <div className={styles.noticeBanner}>
          <ShieldWarning size={18} weight="fill" /> Mode lihat-saja. Hanya Admin yang bisa menambah, mengubah, atau menghapus bin.
        </div>
      )}

      {error && <div className={styles.errorBanner}>⚠ {error} <button onClick={load}>Coba lagi</button></div>}

      {/* Search */}
      <div className={styles.searchBar}>
        <MagnifyingGlass size={18} weight="bold" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari bin — Node ID, lokasi, atau area…"
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery("")} title="Bersihkan">
            <X size={16} />
          </button>
        )}
        <span className={styles.searchCount}>{filteredBins.length} dari {bins.length} bin</span>
      </div>

      {/* Tabel bin */}
      <div className={styles.tablePanel}>
        <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>NODE ID</th>
              <th>LOKASI</th>
              <th>AREA</th>
              <th>KOORDINAT</th>
              <th>STATUS</th>
              {isAdmin && <th className={styles.actionsCol}>AKSI</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={isAdmin ? 6 : 5} className={styles.tableEmpty}>Memuat…</td></tr>
            )}
            {!loading && bins.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} className={styles.tableEmpty}>Belum ada bin terdaftar.</td></tr>
            )}
            {!loading && bins.length > 0 && filteredBins.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} className={styles.tableEmpty}>Tidak ada bin yang cocok dengan &quot;{query}&quot;.</td></tr>
            )}
            {!loading && filteredBins.map((bin) => {
              const vol = binVolume(bin);
              const status = binStatus(bin);
              return (
                <tr key={bin.id} className={styles.clickableRow} onClick={() => setDetailId(bin.id)}>
                  <td className={styles.nodeCell}>{bin.nodeId}</td>
                  <td>{bin.location}</td>
                  <td>{bin.area?.name ?? <span className={styles.muted}>—</span>}</td>
                  <td>
                    <span className={styles.coordCell}>
                      <MapPin size={13} weight="fill" color="#48846c" /> {Number(bin.lat).toFixed(4)}, {Number(bin.lng).toFixed(4)}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[status]}`}>
                      {STATUS_LABEL[status]}{vol !== null ? ` · ${Math.round(vol)}%` : ""}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className={styles.actionsCol}>
                      <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); openEdit(bin); }} title="Ubah">
                        <PencilSimple size={16} />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={(e) => { e.stopPropagation(); remove(bin); }} title="Hapus">
                        <Trash size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal tambah/edit */}
      {open && (
        <div className={styles.overlay} onClick={close}>
          <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className={styles.modalHead}>
              <h2>{editing ? "Ubah Bin" : "Tambah Bin"}</h2>
              <button type="button" className={styles.closeBtn} onClick={close}><X size={18} /></button>
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
                {saving ? <><CircleNotch size={18} weight="bold" className={styles.spin} /> Menyimpan…</> : <><FloppyDisk size={18} weight="fill" /> Simpan</>}
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
              <button type="button" className={styles.closeBtn} onClick={() => setAreaOpen(false)}><X size={18} /></button>
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
                {areaBusy ? <CircleNotch size={18} weight="bold" className={styles.spin} /> : <Plus size={18} weight="bold" />} Tambah
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
                      <button className={styles.iconBtn} onClick={() => saveArea(a.id)} disabled={areaBusy} title="Simpan"><Check size={16} weight="bold" /></button>
                      <button className={styles.iconBtn} onClick={() => setEditAreaId(null)} title="Batal"><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <span className={styles.areaName}>{a.name}</span>
                      <span className={styles.areaCount}>{a._count?.bins ?? 0} bin</span>
                      <button className={styles.iconBtn} onClick={() => { setEditAreaId(a.id); setEditAreaName(a.name); setAreaError(null); }} title="Ubah"><PencilSimple size={16} /></button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => removeArea(a)} title="Hapus"><Trash size={16} /></button>
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
                  <div className={styles.drawerLoc}><MapPin size={14} weight="fill" color="#48846c" /> {detailBin.location}</div>
                </div>
                <button className={styles.closeBtn} onClick={() => setDetailId(null)}><X size={18} /></button>
              </div>

              {/* Status + koneksi */}
              <div className={styles.drawerBadges}>
                <span className={`${styles.statusPill} ${styles[status]}`}>{STATUS_LABEL[status]}</span>
                <span className={`${styles.connPill} ${online ? styles.online : styles.offline}`}>
                  {online ? <WifiHigh size={13} weight="bold" /> : <WifiSlash size={13} weight="bold" />} {online ? "Online" : "Offline"}
                </span>
                <span className={styles.drawerUpdated}>
                  <Clock size={13} weight="regular" /> {timeAgo(r?.timestamp ?? r?.createdAt)}
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
                  <span className={styles.metricLabel}><Scales size={15} weight="duotone" color="#48846c" /> Berat</span>
                  <span className={styles.metricValue}>{r?.weight != null ? `${r.weight} kg` : "–"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><Wind size={15} weight="duotone" color="#5b7c99" /> Gas</span>
                  <span className={styles.metricValue}>{r?.gas != null ? r.gas : "–"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><BatteryMedium size={15} weight="duotone" color="#c79a4a" /> Baterai</span>
                  <span className={styles.metricValue}>{r?.battery != null ? `${r.battery}%` : "–"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}><Gauge size={15} weight="duotone" color="#48846c" /> Volume</span>
                  <span className={styles.metricValue}>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                </div>
              </div>

              {/* Info detail */}
              <div className={styles.infoList}>
                <div className={styles.infoRow}><span>Area</span><strong>{detailBin.area?.name ?? "—"}</strong></div>
                <div className={styles.infoRow}><span>Koordinat</span><strong>{Number(detailBin.lat).toFixed(5)}, {Number(detailBin.lng).toFixed(5)}</strong></div>
                <div className={styles.infoRow}><span>Ambang volume</span><strong>{detailBin.volumeThreshold ?? 80}%</strong></div>
                <div className={styles.infoRow}><span>Ambang berat</span><strong>{detailBin.weightThreshold != null ? `${detailBin.weightThreshold} kg` : "—"}</strong></div>
                <div className={styles.infoRow}><span>Ambang gas</span><strong>{detailBin.gasThreshold ?? "—"}</strong></div>
                <div className={styles.infoRow}><span>Ambang baterai</span><strong>{detailBin.batteryThreshold != null ? `${detailBin.batteryThreshold}%` : "—"}</strong></div>
              </div>

              {/* Aksi */}
              {isAdmin && (
                <div className={styles.drawerActions}>
                  <button className={styles.secondaryBtn} onClick={() => { setDetailId(null); openEdit(detailBin); }}>
                    <PencilSimple size={16} /> Ubah
                  </button>
                  <button className={`${styles.secondaryBtn} ${styles.dangerBtn}`} onClick={() => { setDetailId(null); remove(detailBin); }}>
                    <Trash size={16} /> Hapus
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
