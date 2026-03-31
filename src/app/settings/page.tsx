"use client";

import React, { useState } from 'react';
import styles from './page.module.css';
import { Save, CalendarClock, Trash2, ShieldAlert, CheckCircle2, Truck, Bell } from 'lucide-react';

export default function SettingsPage() {
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  
  const [formData, setFormData] = useState({
    waktuMulai: '06:00',
    waktuSelesai: '18:00',
    ambangBatas: '75',
    hariOperasional: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    prioritaskanKritis: true,
    notifikasiSuara: true,
    kirimWA: false,
    nomorWA: ''
  });

  const toggleHari = (hari: string) => {
    setFormData(prev => ({
      ...prev,
      hariOperasional: prev.hariOperasional.includes(hari) 
        ? prev.hariOperasional.filter(h => h !== hari)
        : [...prev.hariOperasional, hari]
    }));
  };

  return (
    <div className={styles.pageContainer}>
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>Setelan Jadwal Pickup</h1>
          <p>Konfigurasi kapan truk-truk kebersihan akan diterjunkan berdasarkan kapasitas status BIN.</p>
        </div>
        <button className={styles.saveBtn} onClick={() => alert("Pengaturan berhasil disimpan!")}>
          <Save size={18} /> Simpan Perubahan
        </button>
      </header>

      {/* Main Settings Grid */}
      <div className={styles.settingsGrid}>
        
        {/* Panel Kiri: Waktu Operasional */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <CalendarClock size={24} color="#10b981" />
            <h2>Waktu & Hari Operasional</h2>
          </div>
          <div className={styles.panelBody}>
            
            <div className={styles.formGroup}>
              <label>Pilih Hari Aktif Pengosongan:</label>
              <div className={styles.daysGrid}>
                {days.map(d => {
                  const isActive = formData.hariOperasional.includes(d);
                  return (
                    <button 
                      key={d} 
                      className={`${styles.dayBtn} ${isActive ? styles.dayActive : ''}`}
                      onClick={() => toggleHari(d)}
                    >
                      {isActive && <CheckCircle2 size={14} />} {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.timeGroup}>
              <div className={styles.formGroup}>
                <label>Jam Mulai Shift</label>
                <input 
                  type="time" 
                  value={formData.waktuMulai} 
                  onChange={(e) => setFormData({...formData, waktuMulai: e.target.value})}
                  className={styles.timeInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Jam Selesai Shift</label>
                <input 
                  type="time" 
                  value={formData.waktuSelesai} 
                  onChange={(e) => setFormData({...formData, waktuSelesai: e.target.value})}
                  className={styles.timeInput}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Panel Tengah: Aturan Otomatis */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <ShieldAlert size={24} color="#f59e0b" />
            <h2>Aturan Pengosongan (Threshold)</h2>
          </div>
          <div className={styles.panelBody}>
            
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label>Ambang Batas Kapasitas Status Waspada (%)</label>
                <span className={styles.percentValue}>{formData.ambangBatas}%</span>
              </div>
              <input 
                type="range" 
                min="50" max="95" step="5"
                value={formData.ambangBatas}
                onChange={(e) => setFormData({...formData, ambangBatas: e.target.value})}
                className={styles.rangeSlider}
              />
              <p className={styles.hintText}>Truk akan secara otomatis dijadwalkan ketika tong sampah mencapai kapasitas di atas batas ini.</p>
            </div>

            <div className={styles.formDivider}></div>

            <div className={styles.switchGroup} onClick={() => setFormData({...formData, prioritaskanKritis: !formData.prioritaskanKritis})}>
              <div className={styles.switchText}>
                <label>Prioritaskan Notifikasi Kritis (&gt;90%)</label>
                <p>Truk akan me-bypass antrean normal jika status sangat mendesak.</p>
              </div>
              <div className={`${styles.switch} ${formData.prioritaskanKritis ? styles.switchActive : ''}`}>
                <div className={styles.switchDot}></div>
              </div>
            </div>

          </div>
        </div>

        {/* Panel Kanan (Baru): Sistem Notifikasi */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Bell size={24} color="#8b5cf6" />
            <h2>Notifikasi & Peringatan Petugas</h2>
          </div>
          <div className={styles.panelBody}>
            
            <div className={styles.switchGroup} onClick={() => setFormData({...formData, notifikasiSuara: !formData.notifikasiSuara})}>
              <div className={styles.switchText}>
                <label>Alarm Dasbor Bunyi</label>
                <p>Bunyikan sirine peringatan di browser ketika ada area yang Kritis.</p>
              </div>
              <div className={`${styles.switch} ${formData.notifikasiSuara ? styles.switchActiveBlue : ''}`}>
                <div className={styles.switchDot}></div>
              </div>
            </div>

            <div className={styles.formDivider}></div>

            <div className={styles.switchGroup} onClick={() => setFormData({...formData, kirimWA: !formData.kirimWA})}>
              <div className={styles.switchText}>
                <label>Integrasi WhatsApp Bot</label>
                <p>Kirimkan notifikasi langsung ke grup WhatsApp armada pengangkut untuk rute mendesak.</p>
              </div>
              <div className={`${styles.switch} ${formData.kirimWA ? styles.switchActiveGreen : ''}`}>
                <div className={styles.switchDot}></div>
              </div>
            </div>

            {formData.kirimWA && (
              <div className={styles.waInputWrapper}>
                <label>Nomor Telepon Petugas/Grup (+62)</label>
                <div className={styles.waInputContainer}>
                  <span className={styles.waPrefix}>+62</span>
                  <input 
                    type="text" 
                    placeholder="812 3456 7890" 
                    className={styles.waInput}
                    value={formData.nomorWA}
                    onChange={(e) => setFormData({...formData, nomorWA: e.target.value})}
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Panel Bawah: Manajemen Armada Truk */}
        <div className={`${styles.panel} ${styles.fullWidthPanel}`}>
          <div className={styles.panelHeader}>
            <Truck size={24} color="#3b82f6" />
            <h2>Penugasan Armada Truk (Auto-Dispatch)</h2>
          </div>
          <div className={styles.panelBody}>
            <p className={styles.hintText}>Tentukan kode truk mana yang akan otomatis dijadwalkan ketika status BIN di suatu zona menjadi Kritis/Waspada.</p>
            
            <div className={styles.truckList}>
              {[
                { id: 'TRK-01', route: 'Zona A', status: 'SELESAI', color: 'green' },
                { id: 'TRK-02', route: 'Zona B', status: 'PENDING', color: 'yellow' },
                { id: 'TRK-03', route: 'Zona C', status: 'SELESAI', color: 'green' },
                { id: 'TRK-04', route: 'Zona D', status: 'TRANSIT', color: 'blue' },
                { id: 'TRK-05', route: 'Zona E', status: 'SELESAI', color: 'green' },
              ].map((trk) => (
                <div key={trk.id} className={styles.truckItem}>
                  <div className={styles.truckInfo}>
                    <div className={styles.truckIcon}><Truck size={18} /></div>
                    <div className={styles.truckMeta}>
                      <span className={styles.truckName}>{trk.id}</span>
                      <span className={`${styles.statusPill} ${styles[trk.color]}`}>{trk.status}</span>
                    </div>
                  </div>
                  <select className={styles.truckSelect} defaultValue={trk.route}>
                    <option value="Otomatis (Dinamic)">Otomatis (Rute Dinamis)</option>
                    <option value="Zona A">Prioritas Zona A</option>
                    <option value="Zona B">Prioritas Zona B</option>
                    <option value="Zona C">Prioritas Zona C</option>
                    <option value="Zona D">Prioritas Zona D</option>
                    <option value="Zona E">Prioritas Zona E</option>
                    <option value="Standby">Siaga (Standby)</option>
                  </select>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
