import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create custom icons using Lucide or basic Leaflet dots
const normalIcon = new L.DivIcon({
  className: '',
  html: `<div style="background-color: #48846c; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const warningIcon = new L.DivIcon({
  className: '',
  html: `<div style="background-color: #d89b3f; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const criticalIcon = new L.DivIcon({
  className: '',
  html: `<div style="background-color: #d1565a; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(209, 86, 90, 0.6); animation: pulse 2s infinite;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

export default function MapTracker() {
  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(209, 86, 90, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(209, 86, 90, 0); }
          100% { box-shadow: 0 0 0 0 rgba(209, 86, 90, 0); }
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
        center={[-6.914744, 107.609810]} 
        zoom={13} 
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Simulate Bins using the references in the image */}
        <Marker position={[-6.912744, 107.609810]} icon={normalIcon}>
          <Popup>BIN-055 • Normal (20%)</Popup>
        </Marker>
        
        <Marker position={[-6.924744, 107.619810]} icon={warningIcon}>
          <Popup>BIN-089 • Waspada (78%)</Popup>
        </Marker>
        
        <Marker position={[-6.904744, 107.609810]} icon={criticalIcon}>
          <Popup>BIN-042 • Kritis (96%)<br/>Segera dikosongkan</Popup>
        </Marker>
        
        <Marker position={[-6.920744, 107.599810]} icon={normalIcon}>
          <Popup>BIN-059 • Normal (10%)</Popup>
        </Marker>

      </MapContainer>
    </>
  );
}
