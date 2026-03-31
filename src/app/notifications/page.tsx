"use client";

import React, { useState } from 'react';
import styles from './page.module.css';
import { Bell, AlertTriangle, AlertCircle, Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const [filter, setFilter] = useState('Semua');

  const notifications = [
    {
      id: 1,
      title: 'BIN-042 Darmo Kali',
      type: 'critical',
      message: 'Kapasitas 96% • Segera dikosongkan',
      time: '2 menit yang lalu',
      unread: true,
    },
    {
      id: 2,
      title: 'BIN-089 Gubeng',
      type: 'warning',
      message: 'Kapasitas 78%',
      time: '5 menit yang lalu',
      unread: true,
    },
    {
      id: 3,
      title: 'BIN-055 Rungkut',
      type: 'normal',
      message: 'Pickup selesai • 0%',
      time: '1 jam yang lalu',
      unread: false,
    },
    {
      id: 4,
      title: 'BIN-059 Ciganitri',
      type: 'normal',
      message: 'Ganti Baterai berhasil • 100%',
      time: '1 jam yang lalu',
      unread: false,
    },
    {
      id: 5,
      title: 'Sistem Terputus',
      type: 'critical',
      message: 'Koneksi ke BIN-012 terputus selama 2 jam.',
      time: '2 jam yang lalu',
      unread: false,
    },
  ];

  return (
    <div className={styles.pageContainer}>
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Link href="/">
            <button className={styles.backButton}>
              <ArrowLeft size={20} />
            </button>
          </Link>
          <h1>Notifikasi</h1>
        </div>
        <button className={styles.markReadBtn}>
          <CheckCircle2 size={16} /> Tandai semua dibaca
        </button>
      </header>

      <div className={styles.panel}>
        {/* Filters */}
        <div className={styles.filterBar}>
          {['Semua', 'Belum dibaca', 'Kritis', 'Peringatan'].map(fv => (
            <button 
              key={fv}
              className={`${styles.filterBtn} ${filter === fv ? styles.active : ''}`}
              onClick={() => setFilter(fv)}
            >
              {fv}
            </button>
          ))}
        </div>

        {/* List */}
        <div className={styles.listContainer}>
          {notifications.map(n => (
            <div key={n.id} className={`${styles.notifItem} ${styles[n.type]} ${n.unread ? styles.unread : ''}`}>
              
              <div className={styles.notifIcon}>
                {n.type === 'critical' && <AlertTriangle size={24} />}
                {n.type === 'warning' && <AlertCircle size={24} />}
                {n.type === 'normal' && <Trash2 size={24} />}
              </div>
              
              <div className={styles.notifContent}>
                <div className={styles.notifHeader}>
                  <h2>{n.title}</h2>
                  <span className={styles.time}>{n.time}</span>
                </div>
                <p className={styles.message}>{n.message}</p>
              </div>
              
              {n.unread && <div className={styles.unreadIndicator}></div>}

            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
