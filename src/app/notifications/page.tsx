"use client";

import React, { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";
import { WarningIcon, WarningCircleIcon, BatteryLowIcon, WindIcon, CheckCircleIcon, CaretDownIcon } from "@phosphor-icons/react";
import * as api from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import { timeAgo } from "@/lib/binStatus";
import type { Alert, AlertType } from "@/lib/types";

const FILTERS = ["Semua", "Belum dibaca", "Kritis", "Peringatan"] as const;
type Filter = (typeof FILTERS)[number];

// Tipe alert mana yang dianggap "kritis".
const CRITICAL_TYPES: AlertType[] = ["FULL_VOLUME", "FULL_WEIGHT", "GAS_HIGH"];

// Label jenis alert yang ramah dibaca.
const TYPE_LABEL: Record<AlertType, string> = {
  FULL_VOLUME: "Volume penuh",
  FULL_WEIGHT: "Berat melebihi ambang",
  BATTERY_LOW: "Baterai lemah",
  GAS_HIGH: "Kadar gas tinggi",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function alertVisual(type: AlertType) {
  switch (type) {
    case "FULL_VOLUME":
    case "FULL_WEIGHT":
      return { cls: "critical", icon: <WarningIcon size={20} weight="duotone" /> };
    case "GAS_HIGH":
      return { cls: "critical", icon: <WindIcon size={20} weight="duotone" /> };
    case "BATTERY_LOW":
      return { cls: "warning", icon: <BatteryLowIcon size={20} weight="duotone" /> };
    default:
      return { cls: "warning", icon: <WarningCircleIcon size={20} weight="duotone" /> };
  }
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>("Semua");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Ambil yang belum & sudah selesai, lalu gabung — supaya notifikasi yang
      // baru ditandai dibaca tidak ikut hilang dari daftar.
      const [unres, res] = await Promise.all([
        api.getAlerts({ limit: 100, resolved: false }),
        api.getAlerts({ limit: 100, resolved: true }),
      ]);
      const merged = [...unres.alerts, ...res.alerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setAlerts(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat notifikasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime((event) => {
    if (event === "ALERT_NEW" || event === "ALERT_RESOLVED") load();
  });

  const resolve = async (id: string) => {
    setBusy(id);
    try {
      await api.resolveAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyelesaikan alert");
    } finally {
      setBusy(null);
    }
  };

  // Klik notifikasi: buka/tutup detail; saat dibuka & belum dibaca → tandai selesai.
  const toggle = (n: Alert) => {
    const willOpen = expandedId !== n.id;
    setExpandedId(willOpen ? n.id : null);
    if (willOpen && !n.resolved && busy !== n.id) resolve(n.id);
  };

  const unreadCount = alerts.filter((a) => !a.resolved).length;

  const filtered = alerts.filter((a) => {
    switch (filter) {
      case "Belum dibaca": return !a.resolved;
      case "Kritis": return CRITICAL_TYPES.includes(a.type);
      case "Peringatan": return !CRITICAL_TYPES.includes(a.type);
      default: return true;
    }
  });

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <div>
            <h1>Notifikasi</h1>
            <p className={styles.subtitle}>{unreadCount} belum diselesaikan dari {alerts.length} total</p>
          </div>
        </div>
      </header>

      <div className={styles.panel}>
        <div className={styles.filterBar}>
          {FILTERS.map((fv) => (
            <button key={fv} className={`${styles.filterBtn} ${filter === fv ? styles.active : ""}`} onClick={() => setFilter(fv)}>
              {fv}
            </button>
          ))}
        </div>

        {error && <div style={{ padding: "12px 16px", color: "var(--color-red)" }}>⚠ {error}</div>}

        <div className={styles.listContainer}>
          {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>Memuat…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>Tidak ada notifikasi.</div>
          )}
          {filtered.map((n) => {
            const v = alertVisual(n.type);
            const isOpen = expandedId === n.id;
            return (
              <div key={n.id} className={`${styles.notifItem} ${styles[v.cls]} ${!n.resolved ? styles.unread : styles.resolvedItem}`}>
                <button className={styles.notifRow} onClick={() => toggle(n)} aria-expanded={isOpen}>
                  <span className={styles.notifIcon}>{v.icon}</span>
                  <span className={styles.notifContent}>
                    <span className={styles.notifHeader}>
                      <span className={styles.notifTitle}>
                        {!n.resolved && <span className={styles.unreadDot} />}
                        {n.bin?.nodeId ?? "Bin"}{n.bin?.location ? ` · ${n.bin.location}` : ""}
                      </span>
                      <span className={styles.time}>{timeAgo(n.createdAt)}</span>
                    </span>
                    <span className={styles.message}>{n.message}</span>
                  </span>
                  <CaretDownIcon size={16} weight="bold" className={styles.caret} data-open={isOpen} />
                </button>

                {isOpen && (
                  <div className={styles.notifDetail}>
                    <div className={styles.detailRow}><span>Jenis</span><strong>{TYPE_LABEL[n.type]}</strong></div>
                    <div className={styles.detailRow}><span>Bin</span><strong>{n.bin?.nodeId ?? "—"}</strong></div>
                    <div className={styles.detailRow}><span>Lokasi</span><strong>{n.bin?.location ?? "—"}</strong></div>
                    <div className={styles.detailRow}><span>Waktu</span><strong>{formatDateTime(n.createdAt)}</strong></div>
                    <div className={styles.detailRow}>
                      <span>Status</span>
                      <strong className={n.resolved ? styles.statusRead : styles.statusNew}>
                        {n.resolved ? <><CheckCircleIcon size={14} weight="fill" /> Sudah dibaca</> : "Baru"}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
