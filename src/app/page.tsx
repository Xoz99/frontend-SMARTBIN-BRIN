"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { 
  Trash2, AlertCircle, AlertTriangle, Truck, 
  Clock, User, TrendingUp, Maximize2, Compass, Bell, Home as HomeIcon, BarChart2, Settings,
  Thermometer, Droplets, BatteryMedium
} from "lucide-react";
import dynamic from 'next/dynamic';

// Disable SSR for Map since window is not defined
const MapTracker = dynamic(() => import('@/components/MapTracker'), { 
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder}>Loading Map...</div> 
});

export default function Home() {
  const [time, setTime] = useState("");

  useEffect(() => {
    // Basic clock implementation
    const updateTime = () => setTime(new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '.'));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.dashboardContainer}>
      
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.greeting}>
          <h1>Halo, Andrian! 👋</h1>
          <p>Petugas Kebersihan • Bandung, Kamis, 12 Maret 2026</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timeBadge}>
            <Clock size={16} />
            <span>{time || "23.19.05"}</span>
          </div>
          <button className={styles.profileButton}>
            <User size={20} />
          </button>
        </div>
      </header>

      {/* METRICS GRID */}
      <section className={styles.metricsGrid}>
        
        <div className={styles.statCard} data-type="active">
          <div className={styles.statHeader}>
            <span>Total Bin Aktif</span>
            <div className={styles.statIconContainer}><Trash2 size={18} /></div>
          </div>
          <div className={styles.statValue}>248</div>
          <div className={styles.statFooter}>
            <TrendingUp size={14} /> 12 bin baru bulan ini
          </div>
        </div>

        <div className={styles.statCard} data-type="warning">
          <div className={styles.statHeader}>
            <span>Perlu Dikosongkan</span>
            <div className={styles.statIconContainer}><AlertCircle size={18} /></div>
          </div>
          <div className={styles.statValue}>37</div>
          <div className={styles.statFooter}>
            <AlertCircle size={14} /> Kapasitas &gt;75%
          </div>
        </div>

        <div className={styles.statCard} data-type="critical">
          <div className={styles.statHeader}>
            <span>Status Kritis</span>
            <div className={styles.statIconContainer}><AlertTriangle size={18} /></div>
          </div>
          <div className={styles.statValue}>8</div>
          <div className={styles.statFooter}>
            <AlertTriangle size={14} /> Kapasitas &gt;90%
          </div>
        </div>

        <div className={styles.statCard} data-type="pickup">
          <div className={styles.statHeader}>
            <span>Pickup Hari Ini</span>
            <div className={styles.statIconContainer}><Truck size={18} /></div>
          </div>
          <div className={styles.statValue}>19</div>
          <div className={styles.statFooter}>
            <Truck size={14} /> 14 selesai • 5 pending
          </div>
        </div>

      </section>

      {/* DUAL GRID - MAP & NOTIFS */}
      <section className={styles.mainGrid}>
        
        {/* Real-time Map Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Peta Lokasi Real-time</h2>
            <button className={styles.panelAction}><Maximize2 size={18} /></button>
          </div>
          <div className={styles.mapPlaceholder}>
             <MapTracker />
             <div className={styles.mapLegend}>
               <div className={styles.legendItem}>
                 <span className={`${styles.legendDot} ${styles.normal}`}></span> Normal
               </div>
               <div className={styles.legendItem}>
                 <span className={`${styles.legendDot} ${styles.warning}`}></span> Waspada
               </div>
               <div className={styles.legendItem}>
                 <span className={`${styles.legendDot} ${styles.critical}`}></span> Kritis
               </div>
             </div>
          </div>
        </div>

        {/* Notifications Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Notifikasi Aktif</h2>
            <span className={styles.panelBadge}>11 baru</span>
          </div>
          
          <div className={`${styles.notificationList} ${styles.noScrollbar}`}>
            
            <div className={styles.notificationItem} data-type="critical">
              <div className={styles.notifIcon}><AlertTriangle size={18} /></div>
              <div className={styles.notifContent}>
                <div className={styles.notifHeader}>
                  <div className={styles.notifTitle}>BIN-042 <span className={styles.notifLocation}>• Darmo Kali</span></div>
                  <span className={styles.notifTime}>2m</span>
                </div>
                <div className={styles.notifDesc}>Kapasitas 96% • Segera dikosongkan</div>
              </div>
            </div>

            <div className={styles.notificationItem} data-type="warning">
              <div className={styles.notifIcon}><AlertCircle size={18} /></div>
              <div className={styles.notifContent}>
                <div className={styles.notifHeader}>
                  <div className={styles.notifTitle}>BIN-089 <span className={styles.notifLocation}>• Gubeng</span></div>
                  <span className={styles.notifTime}>5m</span>
                </div>
                <div className={styles.notifDesc}>Kapasitas 78%</div>
              </div>
            </div>

            <div className={styles.notificationItem} data-type="normal">
              <div className={styles.notifIcon}><Trash2 size={18} /></div>
              <div className={styles.notifContent}>
                <div className={styles.notifHeader}>
                  <div className={styles.notifTitle}>BIN-055 <span className={styles.notifLocation}>• Rungkut</span></div>
                  <span className={styles.notifTime}>1j</span>
                </div>
                <div className={styles.notifDesc}>Pickup selesai • 0%</div>
              </div>
            </div>

            <div className={styles.notificationItem} data-type="normal">
              <div className={styles.notifIcon}><Trash2 size={18} /></div>
              <div className={styles.notifContent}>
                <div className={styles.notifHeader}>
                  <div className={styles.notifTitle}>BIN-059 <span className={styles.notifLocation}>• Ciganitri</span></div>
                  <span className={styles.notifTime}>1j</span>
                </div>
                <div className={styles.notifDesc}>Ganti Baterai berhasil • 100%</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* BOTTOM SECTION - STATUS & JADWAL */}
      <section className={styles.mainGrid}>
        {/* Status Bin - Tampilan Cepat */}
        <div className={styles.transparentPanel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Status Bin – Tampilan Cepat</h2>
          </div>
          <div className={styles.statusBinGrid}>
            
            <div className={`${styles.statusBinCard} ${styles.redCard}`}>
              <div className={styles.binId}>BIN-042</div>
              <div className={styles.binLocation}>Darmo kali</div>
              <div className={styles.binProgressHeader}>
                <span>Terisi</span>
                <span>75%</span>
              </div>
              <div className={styles.binProgressBar}>
                <div className={styles.binProgressFill} style={{ width: '75%' }}></div>
              </div>
              <div className={styles.binMetrics}>
                <span className={styles.binMetricPill}><Thermometer size={14} color="#d1565a" /> 48°C</span>
                <span className={styles.binMetricPill}><Droplets size={14} color="#3b82f6" /> 60%</span>
                <span className={styles.binMetricPill}><BatteryMedium size={14} color="#10b981" /> 88%</span>
              </div>
            </div>

            <div className={`${styles.statusBinCard} ${styles.orangeCard}`}>
              <div className={styles.binId}>BIN-089</div>
              <div className={styles.binLocation}>Gubeng</div>
              <div className={styles.binProgressHeader}>
                <span>Terisi</span>
                <span>65%</span>
              </div>
              <div className={styles.binProgressBar}>
                <div className={styles.binProgressFill} style={{ width: '65%' }}></div>
              </div>
              <div className={styles.binMetrics}>
                <span className={styles.binMetricPill}><Thermometer size={14} color="#d89b3f" /> 37°C</span>
                <span className={styles.binMetricPill}><Droplets size={14} color="#3b82f6" /> 60%</span>
                <span className={styles.binMetricPill}><BatteryMedium size={14} color="#10b981" /> 88%</span>
              </div>
            </div>

          </div>
        </div>

        {/* Jadwal Pickup */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Jadwal Pickup</h2>
          </div>
          <div className={styles.pickupTableWrapper}>
            <table className={styles.pickupTable}>
              <thead>
                <tr>
                  <th>TRUK</th>
                  <th>RUTE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>TRK-01</td>
                  <td>Zona A • 6bin</td>
                  <td className={styles.statusSelesai}>SELESAI</td>
                </tr>
                <tr>
                  <td>TRK-02</td>
                  <td>Zona B • 1bin</td>
                  <td className={styles.statusPending}>PENDING</td>
                </tr>
                <tr>
                  <td>TRK-03</td>
                  <td>Zona C • 6bin</td>
                  <td className={styles.statusSelesai}>SELESAI</td>
                </tr>
                <tr>
                  <td>TRK-04</td>
                  <td>Zona D • 6bin</td>
                  <td className={styles.statusTransit}>TRANSIT</td>
                </tr>
                <tr>
                  <td>TRK-05</td>
                  <td>Zona E • 6bin</td>
                  <td className={styles.statusSelesai}>SELESAI</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}
