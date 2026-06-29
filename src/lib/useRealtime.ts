"use client";

// Hook WebSocket realtime ke backend SmartBIN.
// Koneksi: ws://host?token=<JWT>. Setiap pesan: { event, payload }.
// Pakai: useRealtime((event, payload) => { ... }) — callback dipanggil
// tiap event masuk. Otomatis reconnect dengan backoff.

import { useEffect, useRef } from "react";
import { getToken } from "./api";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "") || "ws://localhost:3000";

export type RealtimeEvent =
  | "CONNECTED"
  | "BIN_UPDATE"
  | "BIN_STATUS"
  | "ALERT_NEW"
  | "ALERT_RESOLVED"
  | "CLASSIFICATION_NEW"
  | "PICKUP_COMPLETED"
  | "PICKUP_CONFIRMED";

type Handler = (event: RealtimeEvent, payload: Record<string, unknown>) => void;

export function useRealtime(onEvent: Handler, enabled = true) {
  // Simpan callback di ref agar koneksi tidak dibuat ulang tiap render.
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    let ws: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        retry = 0;
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as {
            event: RealtimeEvent;
            payload: Record<string, unknown>;
          };
          handlerRef.current(msg.event, msg.payload ?? {});
        } catch {
          /* abaikan pesan yang tidak valid */
        }
      };

      ws.onclose = () => {
        if (closed) return;
        // Backoff: 1s, 2s, 4s ... maks 15s
        const delay = Math.min(15000, 1000 * 2 ** retry);
        retry += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [enabled]);
}
