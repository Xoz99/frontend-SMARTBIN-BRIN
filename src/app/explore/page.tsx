"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import { Search, SlidersHorizontal, MapPin, X, LayoutList } from 'lucide-react';

const MapTracker = dynamic(() => import('@/components/MapTracker'), { 
  ssr: false,
  loading: () => <div className={styles.loading}>Memuat Peta Interaktif...</div> 
});

export default function ExploreMapsPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className={styles.mapsContainer}>
      {/* Floating Header/Search bar overlay */}
      <div className={styles.searchOverlay}>
        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input type="text" placeholder="Cari ID Bin atau Nama Lokasi..." className={styles.searchInput} />
          <button className={styles.filterBtn}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* The real map spanning the entire screen */}
      <div className={styles.mapWrapper}>
        <MapTracker />
      </div>

      {/* Floating Info Panel */}
      {isPanelOpen ? (
        <div className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <h3>Ringkasan Zona</h3>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <span className={styles.panelBadge}>3 Wilayah</span>
              <button className={styles.closePanelBtn} onClick={() => setIsPanelOpen(false)} title="Sembunyikan Panel">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className={styles.zoneList}>
            
            <div className={styles.zoneItem} data-status="normal">
              <div className={styles.zoneIconWrapper}>
                <MapPin size={22} />
              </div>
              <div className={styles.zoneInfo}>
                <h4>Bandung Utara</h4>
                <span className={styles.statusBadge}>42 Bin Normal</span>
              </div>
              <div className={styles.chevron}>›</div>
            </div>

            <div className={styles.zoneItem} data-status="warning">
              <div className={styles.zoneIconWrapper}>
                <MapPin size={22} />
              </div>
              <div className={styles.zoneInfo}>
                <h4>Bandung Tengah</h4>
                <span className={styles.statusBadge}>12 Laporan Waspada</span>
              </div>
              <div className={styles.chevron}>›</div>
            </div>
            
            <div className={styles.zoneItem} data-status="critical">
              <div className={styles.zoneIconWrapper}>
                <MapPin size={22} />
              </div>
              <div className={styles.zoneInfo}>
                <h4>Bandung Selatan</h4>
                <span className={styles.statusBadge}>5 Kritis (Segera Pickup)</span>
              </div>
              <div className={styles.chevron}>›</div>
            </div>

          </div>
        </div>
      ) : (
        <button className={styles.openPanelBtn} onClick={() => setIsPanelOpen(true)}>
          <LayoutList size={18} /> Tampilkan Ringkasan
        </button>
      )}
    </div>
  );
}
