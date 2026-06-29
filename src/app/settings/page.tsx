"use client";

import React, { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';
import { ShieldAlert, Save, CheckCircle2 } from 'lucide-react';
import * as api from '@/lib/api';

export default function SettingsPage() {
  const [threshold, setThreshold] = useState(75);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await api.getSettings();
      setThreshold(s.pickupThreshold);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat setelan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const s = await api.setPickupThreshold(threshold);
      setThreshold(s.pickupThreshold);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan setelan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.pageContainer}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Setelan Pengangkutan</h1>
          <p>Atur ambang kapasitas tong sampah agar otomatis masuk daftar &quot;Perlu Diangkut&quot;.</p>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>⚠ {error} <button onClick={load}>Coba lagi</button></div>
      )}

      {/* Panel Threshold */}
      <div className={styles.settingsGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <ShieldAlert size={24} color="#f59e0b" />
            <h2>Ambang Pengosongan (Threshold)</h2>
          </div>
          <div className={styles.panelBody}>

            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label>Ambang Batas Kapasitas Status Waspada (%)</label>
                <span className={styles.percentValue}>{loading ? '…' : `${threshold}%`}</span>
              </div>
              <input
                type="range"
                min="50" max="95" step="5"
                value={threshold}
                disabled={loading || saving}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className={styles.rangeSlider}
              />
              <p className={styles.hintText}>Tong sampah akan otomatis ditandai &quot;Perlu Diangkut&quot; ketika kapasitasnya mencapai di atas batas ini. Nilai ini dipakai langsung oleh sistem backend.</p>
            </div>

            <div className={styles.formDivider}></div>

            <button className={styles.saveBtn} onClick={save} disabled={loading || saving}>
              {saved ? <><CheckCircle2 size={18} /> Tersimpan</> : <><Save size={18} /> {saving ? 'Menyimpan…' : 'Simpan'}</>}
            </button>

          </div>
        </div>
      </div>

    </div>
  );
}
