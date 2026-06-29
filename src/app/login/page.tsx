"use client";

import React, { useState } from "react";
import { Trash2, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import styles from "./page.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@smartbin.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Terjadi kesalahan, coba lagi.",
      );
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <header className={styles.brand}>
          <div className={styles.logo}>
            <Trash2 size={24} />
          </div>
          <div className={styles.brandText}>
            <h1>Smart BIN</h1>
            <p>Masuk untuk mengelola sistem persampahan.</p>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <label className={styles.field}>
          <span>Email</span>
          <div className={styles.inputBox}>
            <Mail size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@smartbin.local"
              autoComplete="username"
              required
            />
          </div>
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <div className={styles.inputBox}>
            <Lock size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        </label>

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? (
            <><Loader2 size={18} className={styles.spin} /> Memproses…</>
          ) : (
            <>Masuk <ArrowRight size={18} /></>
          )}
        </button>
      </form>
    </div>
  );
}
