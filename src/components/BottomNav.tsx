"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Bell, Home as HomeIcon, BarChart2, Settings } from 'lucide-react';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNavWrapper}>
      <Link href="/explore" className={`${styles.navItem} ${pathname === '/explore' ? styles.active : ''}`}>
        <Compass size={22} />
      </Link>
      <Link href="/notifications" className={`${styles.navItem} ${pathname === '/notifications' ? styles.active : ''}`}>
        <Bell size={22} />
      </Link>
      <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
        <HomeIcon size={22} />
      </Link>
      <Link href="/analytics" className={`${styles.navItem} ${pathname === '/analytics' ? styles.active : ''}`}>
        <BarChart2 size={22} />
      </Link>
      <Link href="/settings" className={`${styles.navItem} ${pathname === '/settings' ? styles.active : ''}`}>
        <Settings size={22} />
      </Link>
    </nav>
  );
}
