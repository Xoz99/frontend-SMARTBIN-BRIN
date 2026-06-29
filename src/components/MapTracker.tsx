import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Bin, StatusLevel } from '@/lib/types';
import { binStatus, binVolume, STATUS_LABEL } from '@/lib/binStatus';

// Target fokus dari luar (mis. klik bin di panel). `key` dibuat unik tiap klik
// supaya klik bin yang sama tetap memicu fly-to + highlight ulang.
export interface FocusTarget {
  lat: number;
  lng: number;
  key: number;
}

// Ikon titik berwarna sesuai status.
function dotIcon(color: string, size: number, pulse = false) {
  return new L.DivIcon({
    className: '',
    html: `<div style="background-color:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 0 ${pulse ? 6 : 4}px rgba(0,0,0,0.3);${pulse ? 'animation:pulse 2s infinite;' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Marker highlight sementara saat sebuah bin diarahkan dari panel.
const FOCUS_ICON = new L.DivIcon({
  className: '',
  html: `<div class="focus-ring"></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const ICONS: Record<StatusLevel, L.DivIcon> = {
  normal: dotIcon('#48846c', 14),
  warning: dotIcon('#d89b3f', 14),
  critical: dotIcon('#d1565a', 18, true),
  unknown: dotIcon('#9ea5ad', 14),
};

interface Props {
  bins?: Bin[];
  focus?: FocusTarget | null;
}

// Pusat default: Bandung. Jika ada bin, pakai bin pertama yang punya koordinat.
const DEFAULT_CENTER: [number, number] = [-6.914744, 107.60981];

// Terbang ke target fokus setiap kali `focus` berubah.
function MapController({ focus }: { focus: FocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 17, { duration: 1.2 });
  }, [focus, map]);
  return null;
}

export default function MapTracker({ bins, focus }: Props) {
  const points = useMemo(
    () => (bins ?? []).filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number'),
    [bins],
  );
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : DEFAULT_CENTER;

  // Marker bin di-memo agar fokus/highlight tidak memicu render ulang seluruh
  // marker (penyebab "getar"/flicker di react-leaflet).
  const markers = useMemo(
    () =>
      points.map((bin) => {
        const status = binStatus(bin);
        const vol = binVolume(bin);
        return (
          <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={ICONS[status]}>
            <Popup>
              <strong>{bin.nodeId}</strong> • {STATUS_LABEL[status]}
              {vol !== null ? ` (${Math.round(vol)}%)` : ''}
              <br />
              {bin.location}
            </Popup>
          </Marker>
        );
      }),
    [points],
  );

  // Highlight sementara: muncul saat fokus, hilang sendiri setelah 5 detik.
  const [highlight, setHighlight] = useState<FocusTarget | null>(null);
  useEffect(() => {
    if (!focus) return;
    setHighlight(focus);
    const t = setTimeout(() => setHighlight(null), 5000);
    return () => clearTimeout(t);
  }, [focus]);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(209, 86, 90, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(209, 86, 90, 0); }
          100% { box-shadow: 0 0 0 0 rgba(209, 86, 90, 0); }
        }
        @keyframes focusPulse {
          0% { transform: scale(0.6); opacity: 1; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .focus-ring {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid #48846c;
          background: rgba(72, 132, 108, 0.18);
          box-sizing: border-box;
        }
        .focus-ring::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid #48846c;
          animation: focusPulse 1.6s ease-out infinite;
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1;
        }
      `}</style>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MapController focus={focus ?? null} />

        {highlight && (
          <Marker
            position={[highlight.lat, highlight.lng]}
            icon={FOCUS_ICON}
            interactive={false}
            keyboard={false}
            zIndexOffset={1000}
          />
        )}

        {markers}
      </MapContainer>
    </>
  );
}
