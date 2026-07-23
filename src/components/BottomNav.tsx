"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Bell, Home as HomeIcon, BarChart2, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import { useRealtime } from '@/lib/useRealtime';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  // Hitung notifikasi belum dibaca (belum diselesaikan) untuk badge.
  const loadUnread = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    try {
      const { alerts, pagination } = await api.getAlerts({ resolved: false, limit: 100 });
      setUnread(pagination?.total ?? alerts.length);
    } catch {
      /* abaikan — badge tak wajib */
    }
  }, [user]);

  // Muat ulang saat pindah halaman (mis. setelah membaca notif) & saat ada event realtime.
  useEffect(() => { loadUnread(); }, [loadUnread, pathname]);
  useRealtime((event) => {
    if (event === 'ALERT_NEW' || event === 'ALERT_RESOLVED') loadUnread();
  });

  // Sembunyikan navigasi di halaman login.
  if (pathname === '/login') return null;

  return (
    <nav className={styles.bottomNavWrapper}>
      <Link href="/explore" className={`${styles.navItem} ${pathname === '/explore' ? styles.active : ''}`}>
        <Compass size={22} />
      </Link>
      <Link href="/notifications" className={`${styles.navItem} ${pathname === '/notifications' ? styles.active : ''}`}>
        <span className={styles.navIcon}>
          <Bell size={22} />
          {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
        </span>
      </Link>
      <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
        <HomeIcon size={22} />
      </Link>
      <Link href="/analytics" className={`${styles.navItem} ${pathname === '/analytics' ? styles.active : ''}`}>
        <BarChart2 size={22} />
      </Link>
      {user?.role === 'ADMIN' && (
        <Link href="/bins" className={`${styles.navItem} ${pathname === '/bins' ? styles.active : ''}`}>
          <Trash2 size={22} />
        </Link>
      )}
    </nav>
  );
}
