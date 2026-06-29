"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { TrendUp, CalendarDots, MapPin, Warning } from "@phosphor-icons/react";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import type { Alert, Bin, ClassificationSummary, Deposit, WasteLabel, WeeklyVolumePoint } from "@/lib/types";

// Warna & urutan tampil jenis sampah.
const WASTE_META: { label: WasteLabel; name: string; color: string }[] = [
  { label: "organik", name: "Organik", color: "#48846C" },
  { label: "anorganik", name: "Anorganik", color: "#5b7c99" },
  { label: "b3", name: "B3", color: "#c25a5e" },
  { label: "unknown", name: "Lainnya", color: "#c79a4a" },
];

function formatDateID(s: string) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function AnalyticsPage() {
  const periods = ["Hari ini", "Minggu ini", "Bulan ini", "Custom"] as const;
  const [activePeriod, setActivePeriod] = useState<(typeof periods)[number]>("Minggu ini");
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const customRef = useRef<HTMLDivElement | null>(null);

  const [bins, setBins] = useState<Bin[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [weekly, setWeekly] = useState<WeeklyVolumePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Agregasi pemilah dari endpoint resmi (kalau sudah ada). null = belum dimuat,
  // false = endpoint belum tersedia (404) → pakai fallback /deposits.
  const [summary, setSummary] = useState<ClassificationSummary | null | false>(null);
  const [tick, setTick] = useState(0);
  const summaryUnsupported = useRef(false);

  useEffect(() => { setCustomStart(daysAgoISO(7)); setCustomEnd(todayISO()); }, []);

  // Rentang [from, to] sesuai periode aktif. Dipakai untuk query BE & filter.
  const [from, to] = useMemo<[Date, Date]>(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    if (activePeriod === "Hari ini") {
      const s = new Date(); s.setHours(0, 0, 0, 0); return [s, end];
    }
    if (activePeriod === "Minggu ini") {
      const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0); return [s, end];
    }
    if (activePeriod === "Bulan ini") {
      const s = new Date(); s.setDate(1); s.setHours(0, 0, 0, 0); return [s, end];
    }
    const s = customStart ? new Date(customStart) : new Date(daysAgoISO(7));
    const e = customEnd ? new Date(customEnd) : new Date();
    e.setHours(23, 59, 59, 999);
    return [s, e];
  }, [activePeriod, customStart, customEnd]);

  // Muat semua data analitik untuk rentang periode aktif — dikaitkan ke BE.
  const load = useCallback(async () => {
    const range = { from: from.toISOString(), to: to.toISOString() };
    try {
      const [b, a, d, w] = await Promise.all([
        api.getBins(),
        api.getAlerts({ limit: 200, ...range }),
        api.getDeposits(range),
        api.getWeeklyVolume(range),
      ]);
      setBins(b);
      setAlerts(a.alerts);
      setDeposits(d);
      setWeekly(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data analitik");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  // Refetch tiap kali periode (from/to) berubah.
  useEffect(() => { load(); }, [load]);
  // Setiap pemilah memilah (CLASSIFICATION_NEW) atau ada setoran, muat ulang.
  useRealtime((event) => {
    if (event === "CLASSIFICATION_NEW") { load(); setTick((t) => t + 1); }
  });

  useEffect(() => {
    if (!customOpen) return;
    const onClick = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) setCustomOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [customOpen]);

  const handlePeriodClick = (p: (typeof periods)[number]) => {
    setActivePeriod(p);
    setCustomOpen(p === "Custom");
  };

  // Ambil agregasi dari endpoint resmi /classifications/summary saat periode
  // berubah. Kalau backend belum punya (404) → tandai & pakai fallback /deposits.
  useEffect(() => {
    if (summaryUnsupported.current) return;
    let active = true;
    (async () => {
      try {
        const s = await api.getClassificationSummary({ from: from.toISOString(), to: to.toISOString() });
        if (active) setSummary(s);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          summaryUnsupported.current = true;
          if (active) setSummary(false);
        }
      }
    })();
    return () => { active = false; };
  }, [from, to, tick]);

  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  const periodDeposits = useMemo(() => deposits.filter((d) => inRange(d.createdAt)), [deposits, from, to]);
  const periodAlerts = useMemo(() => alerts.filter((a) => inRange(a.createdAt)), [alerts, from, to]);

  // Sumber agregasi: utamakan endpoint resmi; fallback ke /deposits.
  const sum: ClassificationSummary | null = summary ? summary : null;

  // Agregasi jenis sampah hasil pemilah (per label: jumlah & berat).
  const wasteDistribution = useMemo(() => {
    if (sum) {
      return WASTE_META.map((m) => {
        const stat = sum.byLabel.find((b) => b.label === m.label);
        return { ...m, count: stat?.count ?? 0, weightKg: stat?.weightKg ?? 0, value: stat?.percentage ?? 0 };
      });
    }
    const total = periodDeposits.length;
    return WASTE_META.map((m) => {
      const items = periodDeposits.filter((d) => d.label === m.label);
      const count = items.length;
      const weightKg = items.reduce((s, d) => s + (d.weight ?? 0), 0);
      return { ...m, count, weightKg, value: total ? Math.round((count / total) * 100) : 0 };
    });
  }, [sum, periodDeposits]);

  const totalDeposits = sum ? sum.total : periodDeposits.length;
  const totalWeightKg = sum ? (sum.totalWeightKg ?? 0) : periodDeposits.reduce((s, d) => s + (d.weight ?? 0), 0);
  const mostCommon = useMemo(() => {
    const ranked = [...wasteDistribution].sort((a, b) => b.count - a.count);
    return ranked[0]?.count ? ranked[0] : null;
  }, [wasteDistribution]);
  const alertAktif = alerts.filter((a) => !a.resolved).length;

  // Grafik volume mingguan (kg) dari /analytics/weekly-volume.
  const weeklyData = useMemo(
    () => weekly.map((w) => ({ day: DAY_NAMES[new Date(w.day).getDay()], value: Math.round(w.totalKg) })),
    [weekly],
  );
  const maxKg = Math.max(1, ...weeklyData.map((d) => d.value));

  // Bin yang paling sering kena alert dalam periode.
  const topBins = useMemo(() => {
    const counts = new Map<string, { label: string; location: string; count: number }>();
    for (const a of periodAlerts) {
      const key = a.binId;
      const cur = counts.get(key) ?? { label: a.bin?.nodeId ?? "Bin", location: a.bin?.location ?? "-", count: 0 };
      cur.count += 1;
      counts.set(key, cur);
    }
    const arr = [...counts.values()].sort((x, y) => y.count - x.count).slice(0, 5);
    const max = Math.max(1, ...arr.map((a) => a.count));
    return arr.map((a) => ({ ...a, rate: Math.round((a.count / max) * 100) }));
  }, [periodAlerts]);

  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const totalWaste = wasteDistribution.reduce((s, w) => s + w.value, 0) || 1;

  const periodLabel = activePeriod === "Custom"
    ? `${formatDateID(customStart)} – ${formatDateID(customEnd)}`
    : activePeriod.toLowerCase();

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Analitik Data</h1>
          <p>Statistik performa manajemen sampah {periodLabel}.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.periodFilter} role="tablist" ref={customRef}>
            {periods.map((p) => (
              <div key={p} className={styles.periodPillWrap}>
                <button
                  role="tab"
                  aria-selected={activePeriod === p}
                  className={`${styles.periodPill} ${activePeriod === p ? styles.periodPillActive : ""}`}
                  onClick={() => handlePeriodClick(p)}
                >
                  {p === "Custom" && <CalendarDots size={15} weight={activePeriod === p ? "fill" : "regular"} />}{p}
                </button>
                {p === "Custom" && customOpen && activePeriod === "Custom" && (
                  <div className={styles.datePopover} role="dialog">
                    <div className={styles.dateRow}>
                      <label><span>Dari</span>
                        <input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} />
                      </label>
                      <label><span>Sampai</span>
                        <input type="date" value={customEnd} min={customStart} max={todayISO()} onChange={(e) => setCustomEnd(e.target.value)} />
                      </label>
                    </div>
                    <div className={styles.dateActions}>
                      <button type="button" className={styles.datePresetBtn} onClick={() => { setCustomStart(daysAgoISO(7)); setCustomEnd(todayISO()); }}>7 hari</button>
                      <button type="button" className={styles.datePresetBtn} onClick={() => { setCustomStart(daysAgoISO(30)); setCustomEnd(todayISO()); }}>30 hari</button>
                      <button type="button" className={styles.dateApplyBtn} onClick={() => setCustomOpen(false)}>Terapkan</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {error && <div style={{ padding: "12px 16px", color: "var(--color-red)" }}>⚠ {error}</div>}

      {/* KPI Cards (data nyata) */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard} style={{ borderLeftColor: "#48846c" }}>
          <span className={styles.kpiEyebrow}>Total Sampah Terpilah</span>
          <h2>{loading ? "…" : `${totalDeposits} item`}</h2>
          <p className={styles.trendUp}><TrendUp size={13} weight="bold" /> {totalWeightKg ? `${totalWeightKg.toFixed(1)} kg total` : "berat belum tercatat"}</p>
        </div>
        <div className={styles.kpiCard} style={{ borderLeftColor: "#c79a4a" }}>
          <span className={styles.kpiEyebrow}>Jenis Paling Sering</span>
          <h2>{loading ? "…" : (mostCommon ? mostCommon.name : "–")}</h2>
          <p className={styles.trendNeutral}>{mostCommon ? `${mostCommon.count}× (${mostCommon.value}%) dari pemilah` : "Belum ada data pemilahan"}</p>
        </div>
        <div className={styles.kpiCard} style={{ borderLeftColor: "#5b7c99" }}>
          <span className={styles.kpiEyebrow}>Bin Terpantau / Alert Aktif</span>
          <h2>{loading ? "…" : `${bins.length} / ${alertAktif}`}</h2>
          <p className={styles.trendNeutral}>Total bin & alert belum selesai</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}><h2>Volume Sampah 7 Hari (kg)</h2></div>
          <div className={styles.barChartContainer}>
            <div className={styles.chartBars}>
              {weeklyData.map((data, index) => (
                <div key={index} className={styles.barGroup}>
                  <div className={styles.barWrapper}>
                    <div className={styles.barFill} style={{ height: `${(data.value / maxKg) * 100}%` }}>
                      <span className={styles.tooltip}>{data.value}kg</span>
                    </div>
                  </div>
                  <span className={styles.barLabel}>{data.day}</span>
                </div>
              ))}
            </div>
            <div className={styles.chartGridLines}>
              <span>{maxKg}kg</span><span>{Math.round(maxKg * 0.66)}kg</span><span>{Math.round(maxKg * 0.33)}kg</span><span>0</span>
            </div>
          </div>
        </div>

        {/* Donut: distribusi jenis sampah dari hasil pemilah (data nyata) */}
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}>
            <h2>Distribusi Jenis Sampah</h2>
            {totalDeposits === 0 && (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", border: "1px solid var(--border-color)", padding: "2px 8px", borderRadius: 999 }}>belum ada data</span>
            )}
          </div>
          <div className={styles.donutWrapper}>
            <svg viewBox="0 0 200 200" className={styles.donutSvg}>
              <circle cx="100" cy="100" r={donutRadius} fill="none" stroke="#eef0ee" strokeWidth="24" />
              {wasteDistribution.map((seg, i) => {
                const segLength = (seg.value / totalWaste) * donutCircumference;
                const dasharray = `${segLength} ${donutCircumference - segLength}`;
                const dashoffset = -donutOffset;
                donutOffset += segLength;
                return (
                  <circle key={i} cx="100" cy="100" r={donutRadius} fill="none" stroke={seg.color} strokeWidth="24"
                    strokeDasharray={dasharray} strokeDashoffset={dashoffset} transform="rotate(-90 100 100)" />
                );
              })}
              <text x="100" y="95" textAnchor="middle" className={styles.donutCenterValue}>{totalDeposits}</text>
              <text x="100" y="115" textAnchor="middle" className={styles.donutCenterLabel}>item terpilah</text>
            </svg>
            <ul className={styles.donutLegend}>
              {wasteDistribution.map((seg, i) => (
                <li key={i}>
                  <span className={styles.legendDot} style={{ background: seg.color }} />
                  <span className={styles.legendLabel}>{seg.name}</span>
                  <span className={styles.legendValue}>{seg.count} ({seg.value}%)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bin paling sering kena alert (data nyata) */}
      <div className={styles.chartPanel}>
        <div className={styles.panelHeader}><h2>Bin Paling Sering Bermasalah</h2></div>
        <ul className={styles.areaList}>
          {!loading && topBins.length === 0 && (
            <li style={{ padding: 16, color: "var(--text-tertiary)", listStyle: "none" }}>Tidak ada alert pada periode ini.</li>
          )}
          {topBins.map((a, i) => (
            <li key={a.label + i} className={styles.areaItem}>
              <div className={styles.areaRank}>{i + 1}</div>
              <div className={styles.areaBody}>
                <div className={styles.areaHeader}>
                  <span className={styles.areaName}><MapPin size={14} weight="fill" color="#48846c" /> {a.label} • {a.location}</span>
                  <span className={styles.areaFullCount}><Warning size={13} weight="fill" color="#c25a5e" /> {a.count}× alert</span>
                </div>
                <div className={styles.areaProgressBar}>
                  <div className={styles.areaProgressFill} style={{ width: `${a.rate}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
