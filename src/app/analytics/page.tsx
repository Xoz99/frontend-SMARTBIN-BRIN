"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { TrendUpIcon, CalendarDotsIcon, MapPinIcon, WarningIcon } from "@phosphor-icons/react";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useRealtime } from "@/lib/useRealtime";
import type { Alert, Bin, Classification, ClassificationSummary, Deposit, SensorReading, WasteLabel, WeeklyVolumePoint } from "@/lib/types";
import SignalChart from "@/components/SignalChart";
import CompareChart from "@/components/CompareChart";

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

// Format throughput bit/detik → "– / bps / kbps" biar ringkas di tabel.
function fmtBps(v: number | null | undefined) {
  if (v == null) return "–";
  if (v >= 1000) return `${(v / 1000).toFixed(1)} kbps`;
  return `${v.toFixed(0)} bps`;
}

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

  // ── Penelitian kualitas link LoRa (RSSI/SNR/panjang paket per bin) ──
  const [selectedBinId, setSelectedBinId] = useState<string>("");
  const [signalHistory, setSignalHistory] = useState<SensorReading[]>([]);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalUnsupported, setSignalUnsupported] = useState(false);
  // Deteksi jenis sampah (dari tabel classifications) untuk bin terpilih.
  const [detections, setDetections] = useState<Classification[]>([]);
  const [detectLimit, setDetectLimit] = useState(8); // "Muat lebih banyak" (+8, maks 100)

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
  // Realtime: pemilahan → muat ulang analitik; BIN_UPDATE (tiap paket sensor) →
  // tambah titik grafik LoRa secara live tanpa refetch.
  useRealtime((event, payload) => {
    if (event === "CLASSIFICATION_NEW") { load(); setTick((t) => t + 1); }
    else if (event === "BIN_UPDATE") {
      const binId = payload.binId as string | undefined;
      if (!binId || binId !== selectedBinId) return;
      const point: SensorReading = {
        weight: (payload.weight as number) ?? null,
        volume: (payload.volume as number) ?? null,
        battery: (payload.battery as number) ?? null,
        gas: (payload.gas as number) ?? null,
        rssi: (payload.rssi as number) ?? null,
        snr: (payload.snr as number) ?? null,
        packetLen: (payload.packetLen as number) ?? null,
        transport: (payload.transport as "lora" | "http") ?? null,
        seq: (payload.seq as number) ?? null,
        latencyMs: (payload.latencyMs as number) ?? null,
        throughputBps: (payload.throughputBps as number) ?? null,
        createdAt: (payload.timestamp as string) ?? new Date().toISOString(),
      };
      // Hanya tambah titik yang masuk periode terpilih (biar konsisten dgn filter;
      // untuk periode lampau, paket live "sekarang" tidak ikut nyampur).
      const pt = new Date(point.createdAt ?? Date.now()).getTime();
      if (pt < from.getTime() || pt > to.getTime()) return;
      // Riwayat disimpan terbaru-dulu (sesuai endpoint). Prepend & batasi.
      setSignalHistory((prev) => [point, ...prev].slice(0, 2000));
    }
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

  // Default pilih bin-003 (node LoRa) begitu daftar bin termuat; kalau tak ada, bin pertama.
  useEffect(() => {
    if (selectedBinId || bins.length === 0) return;
    const preferred = bins.find((b) => b.nodeId === "bin-003") ?? bins[0];
    if (preferred) setSelectedBinId(preferred.id);
  }, [bins, selectedBinId]);

  // Muat riwayat sinyal (rssi/snr/packetLen) untuk bin terpilih. Refetch saat
  // bin berubah atau ada data realtime baru (tick).
  useEffect(() => {
    if (!selectedBinId) return;
    let active = true;
    setSignalLoading(true);
    (async () => {
      try {
        const rows = await api.getBinHistory(selectedBinId, {
          from: from.toISOString(), to: to.toISOString(), limit: 2000,
        });
        if (active) setSignalHistory(rows);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404 && active) setSignalUnsupported(true);
      } finally {
        if (active) setSignalLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedBinId, from, to, tick]);

  // Reset jumlah tampil ke 8 tiap ganti bin / periode.
  useEffect(() => { setDetectLimit(8); }, [selectedBinId, from, to]);

  // Muat deteksi jenis sampah (tabel classifications) untuk bin + periode terpilih.
  // Refetch saat bin/periode/limit berubah atau ada klasifikasi baru (tick).
  useEffect(() => {
    if (!selectedBinId) { setDetections([]); return; }
    let active = true;
    (async () => {
      try {
        const rows = await api.getClassifications({
          binId: selectedBinId, from: from.toISOString(), to: to.toISOString(), limit: detectLimit,
        });
        if (active) setDetections(rows);
      } catch {
        if (active) setDetections([]); // endpoint belum ada / error → kosongkan
      }
    })();
    return () => { active = false; };
  }, [selectedBinId, from, to, detectLimit, tick]);

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

  // Grafik "Sampah Terpilah 7 Hari" (jumlah item/hari) dari /analytics/weekly-volume.
  const weeklyData = useMemo(
    () => weekly.map((w) => ({ day: DAY_NAMES[new Date(w.day).getDay()], value: w.count })),
    [weekly],
  );
  const maxKg = Math.max(1, ...weeklyData.map((d) => d.value));

  // ── Turunan metrik LoRa dari riwayat sensor (urut kronologis naik) ──
  const lora = useMemo(() => {
    const rows = [...signalHistory]
      .map((r) => ({ ...r, ts: new Date(r.createdAt ?? r.timestamp ?? 0).getTime() }))
      .filter((r) => r.ts > 0)
      .sort((a, b) => a.ts - b.ts);

    const rssi = rows.filter((r) => r.rssi != null && r.rssi !== -999).map((r) => ({ t: r.ts, v: r.rssi as number }));
    const snr = rows.filter((r) => r.snr != null).map((r) => ({ t: r.ts, v: r.snr as number }));
    const len = rows.filter((r) => r.packetLen != null).map((r) => ({ t: r.ts, v: r.packetLen as number }));

    const packets = rows.length;
    const spanSec = packets >= 2 ? (rows[packets - 1].ts - rows[0].ts) / 1000 : 0;
    const perMin = spanSec > 0 ? (packets - 1) / (spanSec / 60) : 0;
    const avgGap = packets >= 2 ? spanSec / (packets - 1) : 0;
    const hasSnr = snr.length > 0;
    const mean = (arr: { v: number }[]) => (arr.length ? arr.reduce((s, p) => s + p.v, 0) / arr.length : null);
    const avgRssi = mean(rssi);
    const avgSnr = mean(snr);

    return { rssi, snr, len, packets, spanSec, perMin, avgGap, hasSnr, avgRssi, avgSnr };
  }, [signalHistory]);

  const selectedBin = bins.find((b) => b.id === selectedBinId);

  // ── Perbandingan transport: LoRa vs HTTP/internet ──
  const compare = useMemo(() => {
    const rows = [...signalHistory]
      .map((r) => ({ ...r, ts: new Date(r.createdAt ?? r.timestamp ?? 0).getTime() }))
      .filter((r) => r.ts > 0);

    const metricsFor = (tp: "lora" | "http") => {
      const rs = rows.filter((r) => r.transport === tp).sort((a, b) => a.ts - b.ts);
      const packets = rs.length;
      const spanSec = packets >= 2 ? (rs[packets - 1].ts - rs[0].ts) / 1000 : 0;
      const perMin = spanSec > 0 ? (packets - 1) / (spanSec / 60) : 0;
      const gaps: number[] = [];
      for (let i = 1; i < rs.length; i++) gaps.push((rs[i].ts - rs[i - 1].ts) / 1000);
      const avgGap = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
      const jitter = gaps.length ? Math.sqrt(gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length) : 0;
      // packet loss dari seq (paket hilang = seq yang bolong)
      const seqs = rs.map((r) => r.seq).filter((s): s is number => s != null);
      let lossPct: number | null = null, expected = 0, received = seqs.length;
      if (seqs.length >= 2) {
        const uniq = new Set(seqs).size;
        expected = Math.max(...seqs) - Math.min(...seqs) + 1;
        received = uniq;
        lossPct = expected > 0 ? Math.max(0, ((expected - uniq) / expected) * 100) : null;
      }
      const latSeries = rs.filter((r) => r.latencyMs != null).map((r) => ({ t: r.ts, v: r.latencyMs as number }));
      const avgLat = latSeries.length ? latSeries.reduce((s, p) => s + p.v, 0) / latSeries.length : null;
      // Throughput bit/detik (diukur di gateway: LoRa dari airtime RF, HTTP dari size/latency)
      const tps = rs.filter((r) => r.throughputBps != null).map((r) => r.throughputBps as number);
      const avgTp = tps.length ? tps.reduce((s, v) => s + v, 0) / tps.length : null;
      return { packets, perMin, avgGap, jitter, lossPct, expected, received, latSeries, avgLat, avgTp };
    };

    const loraM = metricsFor("lora");
    const httpM = metricsFor("http");
    return { lora: loraM, http: httpM, hasAny: loraM.packets > 0 || httpM.packets > 0 };
  }, [signalHistory]);

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
                  {p === "Custom" && <CalendarDotsIcon size={15} weight={activePeriod === p ? "fill" : "regular"} />}{p}
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
        <div className={styles.kpiCard}>
          <span className={styles.kpiEyebrow}>Total Sampah Terpilah</span>
          <h2>{loading ? "…" : `${totalDeposits} item`}</h2>
          <p className={styles.trendUp}><TrendUpIcon size={13} weight="bold" /> {totalWeightKg ? `${totalWeightKg.toFixed(1)} kg total` : "berat belum tercatat"}</p>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiEyebrow}>Jenis Paling Sering</span>
          <h2>{loading ? "…" : (mostCommon ? mostCommon.name : "–")}</h2>
          <p className={styles.trendNeutral}>{mostCommon ? `${mostCommon.count}× (${mostCommon.value}%) dari pemilah` : "Belum ada data pemilahan"}</p>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiEyebrow}>Bin Terpantau / Alert Aktif</span>
          <h2>{loading ? "…" : `${bins.length} / ${alertAktif}`}</h2>
          <p className={styles.trendNeutral}>Total bin & alert belum selesai</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}><h2>Sampah Terpilah 7 Hari (item)</h2></div>
          <div className={styles.barChartContainer}>
            <div className={styles.chartBars}>
              {weeklyData.map((data, index) => (
                <div key={index} className={styles.barGroup}>
                  <div className={styles.barWrapper}>
                    <div className={styles.barFill} style={{ height: `${(data.value / maxKg) * 100}%` }}>
                      <span className={styles.tooltip}>{data.value} item</span>
                    </div>
                  </div>
                  <span className={styles.barLabel}>{data.day}</span>
                </div>
              ))}
            </div>
            <div className={styles.chartGridLines}>
              <span>{maxKg}</span><span>{Math.round(maxKg * 0.66)}</span><span>{Math.round(maxKg * 0.33)}</span><span>0</span>
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
                  <span className={styles.areaName}><MapPinIcon size={14} weight="fill" color="#48846c" /> {a.label} • {a.location}</span>
                  <span className={styles.areaFullCount}><WarningIcon size={13} weight="fill" color="#c25a5e" /> {a.count}× alert</span>
                </div>
                <div className={styles.areaProgressBar}>
                  <div className={styles.areaProgressFill} style={{ width: `${a.rate}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Kualitas Sinyal LoRa (untuk penelitian komunikasi) ── */}
      <div className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <h2>Kualitas Sinyal LoRa {selectedBin ? `• ${selectedBin.nodeId}` : ""}</h2>
          <select
            value={selectedBinId}
            onChange={(e) => setSelectedBinId(e.target.value)}
            style={{ fontSize: 13, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border-color, #e5e7eb)", background: "var(--surface, #fff)", color: "var(--text-primary, #111)" }}
          >
            {bins.map((b) => (
              <option key={b.id} value={b.id}>{b.nodeId} — {b.location}</option>
            ))}
          </select>
        </div>

        {signalUnsupported ? (
          <p style={{ padding: 16, color: "var(--text-tertiary)" }}>
            Endpoint riwayat (/bins/:id/history) belum tersedia di backend.
          </p>
        ) : (
          <>
            {/* Stat ringkas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Paket diterima", value: `${lora.packets}`, sub: signalLoading ? "memuat…" : "sampel" },
                { label: "Throughput", value: lora.perMin ? lora.perMin.toFixed(1) : "–", sub: "paket/menit" },
                { label: "Jeda rata-rata", value: lora.avgGap ? lora.avgGap.toFixed(1) : "–", sub: "detik antar paket" },
                { label: "RSSI rata-rata", value: lora.avgRssi != null ? lora.avgRssi.toFixed(0) : "–", sub: "dBm" },
                { label: "SNR rata-rata", value: lora.avgSnr != null ? lora.avgSnr.toFixed(1) : "–", sub: "dB" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--surface-alt, #f7f9f8)", border: "1px solid var(--border-color, #eef0ee)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary, #888)", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary, #111)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary, #888)", marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Grafik */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
              <SignalChart title="RSSI (kuat sinyal)" unit="dBm" color="#48846C" points={lora.rssi} decimals={0} hint="makin dekat 0 makin kuat" />
              {lora.hasSnr && (
                <SignalChart title="SNR (rasio sinyal/noise)" unit="dB" color="#5b7c99" points={lora.snr} decimals={1} hint="makin tinggi makin bersih" />
              )}
              {lora.len.length > 0 && (
                <SignalChart title="Panjang Paket" unit="B" color="#c79a4a" points={lora.len} decimals={0} />
              )}
            </div>

            {!lora.hasSnr && !signalLoading && lora.packets > 0 && (
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
                Belum ada data SNR — pastikan gateway pakai driver <code>serial</code> (baca baris <code>[RF IN]</code> dari board RX). Data lama (dummy/MQTT) hanya punya RSSI.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Jenis sampah yang terdeteksi (hasil pemilah/kamera) ── */}
      <div className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <h2>Jenis Sampah Terdeteksi {selectedBin ? `• ${selectedBin.nodeId}` : ""}</h2>
          {detections.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", border: "1px solid var(--border-color)", padding: "2px 8px", borderRadius: 999 }}>belum ada</span>
          )}
        </div>
        {detections.length === 0 ? (
          <p style={{ padding: 16, color: "var(--text-tertiary)" }}>
            Belum ada deteksi pemilahan untuk bin ini pada periode {periodLabel}.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {detections.map((d) => {
              const meta = WASTE_META.find((m) => m.label === d.label) ?? WASTE_META[WASTE_META.length - 1];
              return (
                <li key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 6px", borderTop: "1px solid var(--border-color, #eef0ee)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: meta.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", minWidth: 92 }}>{meta.name}</span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 54 }}>
                    {d.confidence != null ? `${Math.round(d.confidence * 100)}%` : "—"}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
                    {new Date(d.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {/* Muat lebih banyak: tampil kalau list penuh (mungkin masih ada) & belum mentok 100 */}
        {detections.length >= detectLimit && detectLimit < 100 && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setDetectLimit((n) => Math.min(100, n + 8))}
              style={{ fontSize: 13, fontWeight: 600, color: "#48846C", background: "transparent", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 8, padding: "7px 16px", cursor: "pointer" }}
            >
              Muat lebih banyak
            </button>
          </div>
        )}
      </div>

      {/* ── Perbandingan Komunikasi: LoRa vs HTTP/Internet ── */}
      <div className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <h2>Perbandingan Komunikasi: LoRa vs HTTP/Internet {selectedBin ? `• ${selectedBin.nodeId}` : ""}</h2>
        </div>

        {!compare.hasAny ? (
          <p style={{ padding: 16, color: "var(--text-tertiary)" }}>
            Data belum ada.
          </p>
        ) : (
          <>
            {/* Tabel perbandingan */}
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 500 }}>Metrik</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", color: "#48846C", fontWeight: 600 }}>LoRa</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", color: "#5b7c99", fontWeight: 600 }}>HTTP/Internet</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: "Paket diterima", l: `${compare.lora.packets}`, h: `${compare.http.packets}` },
                    { label: "Throughput (paket/menit)", l: compare.lora.perMin ? compare.lora.perMin.toFixed(1) : "–", h: compare.http.perMin ? compare.http.perMin.toFixed(1) : "–" },
                    { label: "Jeda rata-rata (detik)", l: compare.lora.avgGap ? compare.lora.avgGap.toFixed(1) : "–", h: compare.http.avgGap ? compare.http.avgGap.toFixed(1) : "–" },
                    { label: "Jitter / std jeda (detik)", l: compare.lora.packets >= 2 ? compare.lora.jitter.toFixed(2) : "–", h: compare.http.packets >= 2 ? compare.http.jitter.toFixed(2) : "–" },
                    { label: "Packet loss (%)", l: compare.lora.lossPct != null ? `${compare.lora.lossPct.toFixed(1)}%` : "–", h: compare.http.lossPct != null ? `${compare.http.lossPct.toFixed(1)}%` : "–" },
                    { label: "Latency rata-rata (ms)", l: compare.lora.avgLat != null ? compare.lora.avgLat.toFixed(0) : "–", h: compare.http.avgLat != null ? compare.http.avgLat.toFixed(0) : "–" },
                    { label: "Throughput rata-rata", l: fmtBps(compare.lora.avgTp), h: fmtBps(compare.http.avgTp) },
                  ]).map((row) => (
                    <tr key={row.label} style={{ borderTop: "1px solid var(--border-color, #eef0ee)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>{row.label}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>{row.l}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>{row.h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grafik latency dua jalur */}
            <CompareChart
              title="Latency device → Server (ms)"
              unit="ms"
              decimals={0}
              hint="Makin rendah makin cepat. Offset jam device saling meniadakan saat LoRa vs HTTP dibandingkan."
              series={[
                { name: "LoRa", color: "#48846C", points: compare.lora.latSeries },
                { name: "HTTP/Internet", color: "#5b7c99", points: compare.http.latSeries },
              ]}
            />

            <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-tertiary)" }}>
              Packet loss dihitung dari lompatan nomor urut (<code>seq</code>) per jalur; latency dari selisih <code>sentAt</code> device dan waktu terima backend.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
