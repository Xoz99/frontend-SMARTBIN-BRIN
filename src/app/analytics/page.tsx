"use client";

import React from 'react';
import styles from './page.module.css';
import { TrendingUp, BarChart2, Zap, CalendarDays } from 'lucide-react';

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

      {/* Charts Section */}
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

    </div>
  );
}
