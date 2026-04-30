"use client";

import React from 'react';
import styles from './page.module.css';
import { TrendingUp, BarChart2, Zap, CalendarDays, MapPin } from 'lucide-react';

export default function AnalyticsPage() {
  const weeklyData = [
    { day: 'Sen', volume: 60 },
    { day: 'Sel', volume: 80 },
    { day: 'Rab', volume: 45 },
    { day: 'Kam', volume: 90 },
    { day: 'Jum', volume: 100 },
    { day: 'Sab', volume: 120 },
    { day: 'Min', volume: 110 },
  ];

  const maxVolume = Math.max(...weeklyData.map(d => d.volume));

  const wasteDistribution = [
    { label: 'Organik',   value: 45, color: '#48846C' },
    { label: 'Anorganik', value: 35, color: '#3b82f6' },
    { label: 'B3',        value: 12, color: '#d1565a' },
    { label: 'Lainnya',   value: 8,  color: '#d89b3f' },
  ];

  const topAreas = [
    { area: 'Darmo',     bins: 14, fullCount: 87, fillRate: 92 },
    { area: 'Gubeng',    bins: 11, fullCount: 72, fillRate: 81 },
    { area: 'Tegalsari', bins: 9,  fullCount: 61, fillRate: 74 },
    { area: 'Wonokromo', bins: 12, fullCount: 54, fillRate: 66 },
    { area: 'Genteng',   bins: 8,  fullCount: 48, fillRate: 58 },
  ];

  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const totalWaste = wasteDistribution.reduce((sum, w) => sum + w.value, 0);

  return (
    <div className={styles.pageContainer}>
      
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1>Analitik Data</h1>
          <p>Statistik performa manajemen sampah bulan ini.</p>
        </div>
        <button className={styles.exportBtn}>Ekspor Laporan</button>
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
