import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Scales, BatteryMedium, Wind, WifiHigh, ArrowSquareOut } from '@phosphor-icons/react';
import type { Bin, StatusLevel } from '@/lib/types';
import { binStatus, binVolume, STATUS_LABEL, latestReading, timeAgo, liveBattery, freshnessLabel, isStale, cleanRssi, formatWeight } from '@/lib/binStatus';

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

const STATUS_COLOR: Record<StatusLevel, string> = {
  normal: '#48846c',
  warning: '#d89b3f',
  critical: '#d1565a',
  unknown: '#9ea5ad',
};

// Format nilai sensor + satuan; tampilkan "—" bila tidak ada data.
function fmt(v: number | null | undefined, unit: string, digits = 0): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}${unit}`;
}

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
        const color = STATUS_COLOR[status];
        const reading = latestReading(bin);
        const online = bin.status === 'online';
        return (
          <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={ICONS[status]}>
            <Popup className="bin-popup" minWidth={224} maxWidth={260}>
              <div className="bp">
                <div className="bp-head">
                  <span className="bp-node">{bin.nodeId}</span>
                  <span
                    className="bp-badge"
                    style={{ color, background: `${color}1f`, borderColor: `${color}55` }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <div className="bp-loc">{bin.location}</div>
                <div className="bp-fresh" style={{ color: isStale(bin) ? '#c0392b' : '#48846c' }}>
                  {freshnessLabel(bin)}
                </div>

                <div className="bp-vol">
                  <div className="bp-vol-row">
                    <span>Volume</span>
                    <span className="bp-vol-num">{vol !== null ? `${Math.round(vol)}%` : '—'}</span>
                  </div>
                  <div className="bp-bar">
                    <div
                      className="bp-bar-fill"
                      style={{ width: `${vol !== null ? Math.min(vol, 100) : 0}%`, background: color }}
                    />
                  </div>
                </div>

                <div className="bp-grid">
                  <div className="bp-metric">
                    <Scales size={17} weight="duotone" className="bp-micon" />
                    <div className="bp-mbody">
                      <span className="bp-mlabel">Berat</span>
                      <span className="bp-mval">{formatWeight(reading?.weightRaw) ?? '—'}</span>
                    </div>
                  </div>
                  <div className="bp-metric">
                    <BatteryMedium size={17} weight="duotone" className="bp-micon" />
                    <div className="bp-mbody">
                      <span className="bp-mlabel">Baterai</span>
                      <span className="bp-mval">{fmt(liveBattery(bin), '%')}</span>
                    </div>
                  </div>
                  <div className="bp-metric">
                    <Wind size={17} weight="duotone" className="bp-micon" />
                    <div className="bp-mbody">
                      <span className="bp-mlabel">Gas</span>
                      <span className="bp-mval">{fmt(reading?.gas, ' ppm')}</span>
                    </div>
                  </div>
                  <div className="bp-metric">
                    <WifiHigh size={17} weight="duotone" className="bp-micon" />
                    <div className="bp-mbody">
                      <span className="bp-mlabel">Sinyal</span>
                      <span className="bp-mval">{fmt(cleanRssi(reading?.rssi), ' dBm')}</span>
                    </div>
                  </div>
                </div>

                <a
                  className="bp-maps"
                  href={`https://www.google.com/maps/search/?api=1&query=${bin.lat},${bin.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buka di Google Maps
                  <ArrowSquareOut size={14} weight="bold" />
                </a>

                <div className="bp-foot">
                  <span className="bp-dot" style={{ background: online ? '#48846c' : '#9ea5ad' }} />
                  {online ? 'Online' : 'Offline'}
                  <span className="bp-sep">•</span>
                  {timeAgo(bin.lastSeen ?? reading?.timestamp ?? reading?.createdAt)}
                </div>
              </div>
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

        /* Popup detail bin — flat, rapi, selaras dgn tema hijau muted */
        .bin-popup .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
          padding: 0;
        }
        .bin-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
          line-height: 1.4;
        }
        .bin-popup .leaflet-popup-tip { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12); }
        .bp {
          font-family: inherit;
          padding: 12px 13px;
          color: #1f2937;
        }
        .bp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 2px;
        }
        .bp-node { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
        .bp-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .bp-loc { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .bp-fresh { font-size: 11px; font-weight: 600; margin-bottom: 10px; }
        .bp-vol { margin-bottom: 11px; }
        .bp-vol-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .bp-vol-num { color: #1f2937; font-variant-numeric: tabular-nums; }
        .bp-bar {
          height: 6px;
          background: #eef0f2;
          border-radius: 3px;
          overflow: hidden;
        }
        .bp-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        .bp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
          padding: 10px 0;
          border-top: 1px solid #eef0f2;
          border-bottom: 1px solid #eef0f2;
        }
        .bp-metric { display: flex; align-items: center; gap: 8px; }
        .bp-micon { color: #48846c; flex-shrink: 0; }
        .bp-mbody { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .bp-mlabel {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #9ca3af;
        }
        .bp-mval { font-size: 13px; font-weight: 700; color: #1f2937; font-variant-numeric: tabular-nums; }
        .bp-foot {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
        }
        .bp-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .bp-sep { color: #d1d5db; }
        .bp-maps {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          font-size: 12px;
          font-weight: 700;
          color: #48846c !important;
          text-decoration: none;
        }
        .bp-maps:hover { color: #3c7460 !important; text-decoration: underline; }
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
