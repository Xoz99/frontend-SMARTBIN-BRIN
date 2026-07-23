"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import { MagnifyingGlassIcon, XIcon, ListBulletsIcon } from "@phosphor-icons/react";
import * as api from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import { binStatus, binVolume } from "@/lib/binStatus";
import type { Bin, StatusLevel } from "@/lib/types";
import type { FocusTarget } from "@/components/MapTracker";

const MapTracker = dynamic(() => import("@/components/MapTracker"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Memuat Peta Interaktif…</div>,
});

interface Zone {
  name: string;
  total: number;
  normal: number;
  warning: number;
  critical: number;
  unknown: number;
}

// Status zona = status terburuk di dalamnya.
function zoneStatus(z: Zone): StatusLevel {
  if (z.critical > 0) return "critical";
  if (z.warning > 0) return "warning";
  if (z.normal > 0) return "normal";
  return "unknown";
}

function zoneLabel(z: Zone): string {
  if (z.critical > 0) return `${z.critical} Kritis (Segera Pickup)`;
  if (z.warning > 0) return `${z.warning} Laporan Waspada`;
  return `${z.total} Bin Normal`;
}

export default function ExploreMapsPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [bins, setBins] = useState<Bin[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBins(await api.getBins());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data peta");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime((event) => {
    if (event === "BIN_UPDATE" || event === "BIN_STATUS" || event === "ALERT_NEW" || event === "ALERT_RESOLVED") load();
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bins;
    return bins.filter((b) => b.nodeId.toLowerCase().includes(q) || b.location.toLowerCase().includes(q));
  }, [bins, query]);

  // Kelompokkan jadi zona berdasarkan nama area.
  const zones = useMemo<Zone[]>(() => {
    const map = new Map<string, Zone>();
    for (const b of bins) {
      const name = b.area?.name ?? "Tanpa Area";
      const z = map.get(name) ?? { name, total: 0, normal: 0, warning: 0, critical: 0, unknown: 0 };
      z.total += 1;
      z[binStatus(b)] += 1;
      map.set(name, z);
    }
    return [...map.values()].sort((a, b) => b.critical - a.critical || b.warning - a.warning);
  }, [bins]);

  // Daftar bin per zona (untuk sublist saat zona diklik).
  const binsByZone = useMemo(() => {
    const map = new Map<string, Bin[]>();
    for (const b of bins) {
      const name = b.area?.name ?? "Tanpa Area";
      const arr = map.get(name) ?? [];
      arr.push(b);
      map.set(name, arr);
    }
    return map;
  }, [bins]);

  return (
    <div className={styles.mapsContainer}>
      <div className={styles.searchOverlay}>
        <div className={styles.searchBox}>
          <MagnifyingGlassIcon size={20} weight="bold" className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Cari ID Bin atau Nama Lokasi…"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.searchClear} onClick={() => setQuery("")} title="Bersihkan">
              <XIcon size={16} weight="bold" />
            </button>
          )}
        </div>

        {query.trim() && (
          <div className={styles.searchResults}>
            {filtered.length === 0 && (
              <div className={styles.searchEmpty}>Tidak ada bin yang cocok.</div>
            )}
            {filtered.slice(0, 8).map((b) => {
              const hasCoord = typeof b.lat === "number" && typeof b.lng === "number";
              const vol = binVolume(b);
              return (
                <button
                  key={b.id}
                  type="button"
                  className={styles.resultRow}
                  data-status={binStatus(b)}
                  disabled={!hasCoord}
                  title={hasCoord ? "Arahkan ke peta" : "Tidak ada koordinat"}
                  onClick={() => {
                    if (!hasCoord) return;
                    setFocus({ lat: b.lat, lng: b.lng, key: Date.now() });
                    setQuery("");
                  }}
                >
                  <span className={styles.binDot} />
                  <span className={styles.resultInfo}>
                    <span className={styles.resultName}>{b.nodeId}</span>
                    <span className={styles.resultLoc}>{b.location}</span>
                  </span>
                  <span className={styles.binMeta}>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                </button>
              );
            })}
          </div>
        )}
        {error && <div style={{ marginTop: 8, color: "var(--color-red)", fontSize: 13 }}>⚠ {error}</div>}
      </div>

      <div className={styles.mapWrapper}>
        <MapTracker bins={filtered} focus={focus} />
      </div>

      {isPanelOpen ? (
        <div className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <h3>Ringkasan Zona</h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className={styles.panelBadge}>{zones.length} Wilayah</span>
              <button className={styles.closePanelBtn} onClick={() => setIsPanelOpen(false)} title="Sembunyikan Panel">
                <XIcon size={16} />
              </button>
            </div>
          </div>
          <div className={styles.zoneList}>
            {zones.length === 0 && <div style={{ padding: 16, color: "var(--text-tertiary)" }}>Belum ada data bin.</div>}
            {zones.map((z) => {
              const isOpen = expanded === z.name;
              const zoneBins = binsByZone.get(z.name) ?? [];
              return (
                <div key={z.name} className={styles.zoneGroup}>
                  <div
                    className={styles.zoneItem}
                    data-status={zoneStatus(z)}
                    data-open={isOpen}
                    onClick={() => setExpanded(isOpen ? null : z.name)}
                  >
                    <span className={styles.zoneDot} />
                    <span className={styles.zoneName}>{z.name}</span>
                    <span className={styles.zoneCount}>{zoneLabel(z)}</span>
                    <span className={styles.zoneCaret}>›</span>
                  </div>
                  {isOpen && (
                    <div className={styles.binSublist}>
                      {zoneBins.map((b) => {
                        const hasCoord = typeof b.lat === "number" && typeof b.lng === "number";
                        const vol = binVolume(b);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            className={styles.binRow}
                            data-status={binStatus(b)}
                            disabled={!hasCoord}
                            title={hasCoord ? "Arahkan ke peta" : "Tidak ada koordinat"}
                            onClick={() => hasCoord && setFocus({ lat: b.lat, lng: b.lng, key: Date.now() })}
                          >
                            <span className={styles.binDot} />
                            <span className={styles.binName}>{b.nodeId}</span>
                            <span className={styles.binMeta}>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <button className={styles.openPanelBtn} onClick={() => setIsPanelOpen(true)}>
          <ListBulletsIcon size={18} weight="bold" /> Tampilkan Ringkasan
        </button>
      )}
    </div>
  );
}
