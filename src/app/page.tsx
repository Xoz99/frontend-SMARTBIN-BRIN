"use client";

import React, { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";
import {
  WarningCircle, Warning,
  Clock, User, ArrowsOut,
  Scales, Wind, BatteryMedium, SignOut,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/lib/useRealtime";
import * as api from "@/lib/api";
import type { Alert, Bin, Pickup } from "@/lib/types";
import {
  binStatus, binVolume, latestReading, timeAgo,
  STATUS_LABEL, WARN_VOLUME, CRIT_VOLUME,
} from "@/lib/binStatus";

const MapTracker = dynamic(() => import("@/components/MapTracker"), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Loading Map...</div>,
});

const STATUS_CARD: Record<string, string> = {
  critical: styles.redCard,
  warning: styles.orangeCard,
  normal: styles.greenCard ?? "",
  unknown: "",
};

function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function Home() {
  const { user, logout } = useAuth();
  const [time, setTime] = useState("");
  const [bins, setBins] = useState<Bin[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [binsData, alertsData, pickupsData] = await Promise.all([
        api.getBins(),
        api.getAlerts({ resolved: false, limit: 50 }),
        api.getPickups({ limit: 50 }),
      ]);
      setBins(binsData);
      setAlerts(alertsData.alerts);
      setPickups(pickupsData.pickups);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Jam berjalan.
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/:/g, "."));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  // Refresh saat ada event realtime relevan.
  useRealtime((event) => {
    if (["BIN_UPDATE", "BIN_STATUS", "ALERT_NEW", "ALERT_RESOLVED", "PICKUP_COMPLETED", "PICKUP_CONFIRMED"].includes(event)) {
      load();
    }
  });

  // Statistik turunan.
  const totalBins = bins.length;
  const perluDikosongkan = bins.filter((b) => { const v = binVolume(b); return v !== null && v >= WARN_VOLUME; }).length;
  const kritis = bins.filter((b) => { const v = binVolume(b); return v !== null && v >= CRIT_VOLUME; }).length;
  const pickupHariIni = pickups.filter((p) => isToday(p.createdAt)).length;
  const pickupSelesai = pickups.filter((p) => isToday(p.createdAt) && p.status === "SELESAI").length;
  const pickupPending = pickupHariIni - pickupSelesai;

  const dateLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className={styles.dashboardContainer}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.greeting}>
          <h1>Halo, {user?.name ?? "Petugas"}! 👋</h1>
          <p>{user?.role === "ADMIN" ? "Administrator" : "Petugas Kebersihan"} • {user?.area?.name ?? "Semua Area"} • {dateLabel}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timeBadge}>
            <Clock size={16} weight="regular" />
            <span>{time || "--.--.--"}</span>
          </div>
          <button className={styles.profileButton} onClick={logout} title="Keluar">
            <SignOut size={18} weight="bold" />
          </button>
          <button className={styles.profileButton}>
            <User size={20} weight="fill" />
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>⚠ {error} <button onClick={load}>Coba lagi</button></div>}

      {/* METRICS GRID */}
      <section className={styles.metricsGrid}>
        <div className={styles.statCard} data-type="active">
          <div className={styles.statHeader}>
            <span>Total Bin Aktif</span>
          </div>
          <div className={styles.statValue}>{loading ? "…" : totalBins}</div>
          <div className={styles.statFooter}>{bins.filter((b) => b.status === "online").length} online</div>
        </div>

        <div className={styles.statCard} data-type="warning">
          <div className={styles.statHeader}>
            <span>Perlu Dikosongkan</span>
          </div>
          <div className={styles.statValue}>{loading ? "…" : perluDikosongkan}</div>
          <div className={styles.statFooter}>Kapasitas &gt;{WARN_VOLUME}%</div>
        </div>

        <div className={styles.statCard} data-type="critical">
          <div className={styles.statHeader}>
            <span>Status Kritis</span>
          </div>
          <div className={styles.statValue}>{loading ? "…" : kritis}</div>
          <div className={styles.statFooter}>Kapasitas &gt;{CRIT_VOLUME}%</div>
        </div>

        <div className={styles.statCard} data-type="pickup">
          <div className={styles.statHeader}>
            <span>Pickup Hari Ini</span>
          </div>
          <div className={styles.statValue}>{loading ? "…" : pickupHariIni}</div>
          <div className={styles.statFooter}>{pickupSelesai} selesai • {pickupPending} menunggu</div>
        </div>
      </section>

      {/* DUAL GRID - MAP & NOTIFS */}
      <section className={styles.mainGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Peta Lokasi Real-time</h2>
            <Link href="/explore" className={styles.panelAction}><ArrowsOut size={18} weight="bold" /></Link>
          </div>
          <div className={styles.mapPlaceholder}>
            <MapTracker bins={bins} />
            <div className={styles.mapLegend}>
              <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.normal}`}></span> Normal</div>
              <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.warning}`}></span> Waspada</div>
              <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.critical}`}></span> Kritis</div>
            </div>
          </div>
        </div>

        {/* Notifications Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Notifikasi Aktif</h2>
            <span className={styles.panelBadge}>{alerts.length} baru</span>
          </div>
          <div className={`${styles.notificationList} ${styles.noScrollbar}`}>
            {!loading && alerts.length === 0 && (
              <div className={styles.emptyState}>Tidak ada notifikasi aktif 🎉</div>
            )}
            {alerts.slice(0, 8).map((a) => {
              const type = a.type === "FULL_VOLUME" || a.type === "FULL_WEIGHT" || a.type === "GAS_HIGH" ? "critical" : "warning";
              return (
                <div key={a.id} className={styles.notificationItem} data-type={type}>
                  <div className={styles.notifIcon}>{type === "critical" ? <Warning size={18} weight="fill" /> : <WarningCircle size={18} weight="fill" />}</div>
                  <div className={styles.notifContent}>
                    <div className={styles.notifHeader}>
                      <div className={styles.notifTitle}>{a.bin?.nodeId ?? "Bin"} <span className={styles.notifLocation}>• {a.bin?.location ?? "-"}</span></div>
                      <span className={styles.notifTime}>{timeAgo(a.createdAt)}</span>
                    </div>
                    <div className={styles.notifDesc}>{a.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BOTTOM SECTION - STATUS & JADWAL */}
      <section className={styles.mainGrid}>
        {/* Status Bin */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Status Bin – Tampilan Cepat</h2>
          </div>
          <div className={styles.statusBinGrid}>
            {!loading && bins.length === 0 && <div className={styles.emptyState}>Belum ada bin terdaftar.</div>}
            {bins.map((bin) => {
              const status = binStatus(bin);
              const vol = binVolume(bin);
              const r = latestReading(bin);
              return (
                <div key={bin.id} className={`${styles.statusBinCard} ${STATUS_CARD[status]}`}>
                  <div className={styles.binId}>{bin.nodeId}</div>
                  <div className={styles.binLocation}>{bin.location}</div>
                  <div className={styles.binProgressHeader}>
                    <span>Terisi • {STATUS_LABEL[status]}</span>
                    <span>{vol !== null ? `${Math.round(vol)}%` : "–"}</span>
                  </div>
                  <div className={styles.binProgressBar}>
                    <div className={styles.binProgressFill} style={{ width: `${vol ?? 0}%` }}></div>
                  </div>
                  <div className={styles.binMetrics}>
                    <span className={styles.binMetricPill}><Scales size={14} weight="duotone" color="#5b7c99" /> {r?.weight != null ? `${r.weight}kg` : "–"}</span>
                    <span className={styles.binMetricPill}><Wind size={14} weight="duotone" color="#c79a4a" /> {r?.gas != null ? `${r.gas}` : "–"}</span>
                    <span className={styles.binMetricPill}><BatteryMedium size={14} weight="duotone" color="#48846c" /> {r?.battery != null ? `${r.battery}%` : "–"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Jadwal Pickup */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Pickup Terbaru</h2>
          </div>
          <div className={styles.pickupTableWrapper}>
            <table className={styles.pickupTable}>
              <thead>
                <tr><th>BIN</th><th>PETUGAS</th><th>STATUS</th></tr>
              </thead>
              <tbody>
                {!loading && pickups.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-tertiary)" }}>Belum ada pickup.</td></tr>
                )}
                {pickups.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td>{p.bin?.nodeId ?? "-"}</td>
                    <td>{p.petugas?.name ?? "-"}</td>
                    <td className={p.status === "SELESAI" ? styles.statusSelesai : styles.statusPending}>
                      {p.status === "SELESAI" ? "SELESAI" : "MENUNGGU"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
