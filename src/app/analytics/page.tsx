"use client";

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { TrendingUp, BarChart2, Zap, CalendarDays, MapPin, Download } from 'lucide-react';

function formatDateID(s: string) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const periods = ['Hari ini', 'Minggu ini', 'Bulan ini', 'Custom'] as const;
  const [activePeriod, setActivePeriod] = useState<typeof periods[number]>('Minggu ini');
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const customRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustomStart(daysAgoISO(7));
    setCustomEnd(todayISO());
  }, []);

  useEffect(() => {
    if (!customOpen) return;
    const onClick = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setCustomOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [customOpen]);

  const handlePeriodClick = (p: typeof periods[number]) => {
    setActivePeriod(p);
    setCustomOpen(p === 'Custom');
  };

  const periodLabel = activePeriod === 'Custom'
    ? `${formatDateID(customStart)} – ${formatDateID(customEnd)}`
    : activePeriod.toLowerCase();

  const weeklyData = [
    { day: 'Sen', volume: 60 },
    { day: 'Sel', volume: 80 },
    { day: 'Rab', volume: 45 },
    { day: 'Kam', volume: 90 },
    { day: 'Jum', volume: 100 },
    { day: 'Sab', volume: 120 },
    { day: 'Min', volume: 110 },
  ];

  const topAreas = [
    { area: 'Darmo',     bins: 14, fullCount: 87, fillRate: 92 },
    { area: 'Gubeng',    bins: 11, fullCount: 72, fillRate: 81 },
    { area: 'Tegalsari', bins: 9,  fullCount: 61, fillRate: 74 },
    { area: 'Wonokromo', bins: 12, fullCount: 54, fillRate: 66 },
    { area: 'Genteng',   bins: 8,  fullCount: 48, fillRate: 58 },
  ];

  const maxVolume = Math.max(...weeklyData.map(d => d.volume));

  const wasteDistribution = [
    { label: 'Organik',   value: 45, color: '#48846C' },
    { label: 'Anorganik', value: 35, color: '#3b82f6' },
    { label: 'B3',        value: 12, color: '#d1565a' },
    { label: 'Lainnya',   value: 8,  color: '#d89b3f' },
  ];

  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const totalWaste = wasteDistribution.reduce((sum, w) => sum + w.value, 0);

  return (
    <div className={styles.pageContainer}>
      
      {/* Header */}
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
                  className={`${styles.periodPill} ${activePeriod === p ? styles.periodPillActive : ''}`}
                  onClick={() => handlePeriodClick(p)}
                >
                  {p === 'Custom' && <CalendarDays size={14} />}
                  {p}
                </button>

                {p === 'Custom' && customOpen && activePeriod === 'Custom' && (
                  <div className={styles.datePopover} role="dialog">
                    <div className={styles.dateRow}>
                      <label>
                        <span>Dari</span>
                        <input
                          type="date"
                          value={customStart}
                          max={customEnd}
                          onChange={(e) => setCustomStart(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Sampai</span>
                        <input
                          type="date"
                          value={customEnd}
                          min={customStart}
                          max={todayISO()}
                          onChange={(e) => setCustomEnd(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className={styles.dateActions}>
                      <button
                        type="button"
                        className={styles.datePresetBtn}
                        onClick={() => { setCustomStart(daysAgoISO(7)); setCustomEnd(todayISO()); }}
                      >
                        7 hari
                      </button>
                      <button
                        type="button"
                        className={styles.datePresetBtn}
                        onClick={() => { setCustomStart(daysAgoISO(30)); setCustomEnd(todayISO()); }}
                      >
                        30 hari
                      </button>
                      <button
                        type="button"
                        className={styles.dateApplyBtn}
                        onClick={() => setCustomOpen(false)}
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className={styles.exportBtn}>
            <Download size={16} />
            Ekspor Laporan
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><BarChart2 size={24} color="#10b981" /></div>
          <div>
            <h3>Total Volume Terkumpul</h3>
            <h2>1,240 kg</h2>
            <p className={styles.trendUp}><TrendingUp size={14} /> +12% dari minggu lalu</p>
          </div>
        </div>
        
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><Zap size={24} color="#f59e0b" /></div>
          <div>
            <h3>Rata-rata Waktu Pick-up</h3>
            <h2>1j 45m</h2>
            <p className={styles.trendUp}><TrendingUp size={14} /> lebih cepat 15 menit</p>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}><CalendarDays size={24} color="#3b82f6" /></div>
          <div>
            <h3>Frekuensi Pengosongan</h3>
            <h2>32 Kali</h2>
            <p className={styles.trendNeutral}>Normal sesuai jadwal</p>
          </div>
        </div>
      </div>

      {/* Charts Row: Bar + Donut */}
      <div className={styles.chartsRow}>
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}>
            <h2>Grafik Volume Sampah Mingguan</h2>
          </div>

          {/* CSS-based Bar Chart */}
          <div className={styles.barChartContainer}>
            <div className={styles.chartBars}>
              {weeklyData.map((data, index) => {
                const heightPercent = (data.volume / maxVolume) * 100;
                return (
                  <div key={index} className={styles.barGroup}>
                    <div className={styles.barWrapper}>
                      <div className={styles.barFill} style={{ height: `${heightPercent}%` }}>
                        <span className={styles.tooltip}>{data.volume}kg</span>
                      </div>
                    </div>
                    <span className={styles.barLabel}>{data.day}</span>
                  </div>
                );
              })}
            </div>

            {/* Y-Axis lines overlay (decorative) */}
            <div className={styles.chartGridLines}>
              <span>120kg</span>
              <span>80kg</span>
              <span>40kg</span>
              <span>0</span>
            </div>
          </div>
        </div>

        {/* Donut: Distribusi Jenis Sampah */}
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}>
            <h2>Distribusi Jenis Sampah</h2>
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
                  <circle
                    key={i}
                    cx="100" cy="100" r={donutRadius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="24"
                    strokeDasharray={dasharray}
                    strokeDashoffset={dashoffset}
                    transform="rotate(-90 100 100)"
                  />
                );
              })}
              <text x="100" y="95" textAnchor="middle" className={styles.donutCenterValue}>1,240</text>
              <text x="100" y="115" textAnchor="middle" className={styles.donutCenterLabel}>kg total</text>
            </svg>
            <ul className={styles.donutLegend}>
              {wasteDistribution.map((seg, i) => (
                <li key={i}>
                  <span className={styles.legendDot} style={{ background: seg.color }} />
                  <span className={styles.legendLabel}>{seg.label}</span>
                  <span className={styles.legendValue}>{seg.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Top Areas (full width) */}
      <div className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <h2>Daerah Paling Sering Penuh</h2>
        </div>
        <ul className={styles.areaList}>
          {topAreas.map((a, i) => (
            <li key={a.area} className={styles.areaItem}>
              <div className={styles.areaRank}>{i + 1}</div>
              <div className={styles.areaBody}>
                <div className={styles.areaHeader}>
                  <span className={styles.areaName}><MapPin size={14} /> {a.area}</span>
                  <span className={styles.areaFullCount}>{a.fullCount}× penuh</span>
                </div>
                <div className={styles.areaProgressBar}>
                  <div className={styles.areaProgressFill} style={{ width: `${a.fillRate}%` }} />
                </div>
                <div className={styles.areaMeta}>
                  <span>{a.bins} bin</span>
                  <span>Rata-rata isi {a.fillRate}%</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
