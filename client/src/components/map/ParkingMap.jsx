import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix leaflet marker icon issues in bundlers
const customParkingIcon = L.divIcon({
  className: 'custom-leaflet-pin',
  html: `
    <div style="background-color: #10b981; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
      <span style="color: white; font-weight: 800; font-size: 15px; font-family: sans-serif;">P</span>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

export default function ParkingMap({ locations = [], selectedLocation = null, onSelectLocation }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  const [center, setCenter] = useState([40.745, -73.985]); // Default center

  useEffect(() => {
    if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
      setCenter([Number(selectedLocation.latitude), Number(selectedLocation.longitude)]);
    } else if (locations.length > 0 && locations[0].latitude) {
      setCenter([Number(locations[0].latitude), Number(locations[0].longitude)]);
    }
  }, [selectedLocation, locations]);

  // If user supplied a valid Google Maps API key, we could toggle to Google Maps
  useEffect(() => {
    if (apiKey && apiKey.trim().length > 10) {
      setUseGoogleMaps(true);
    }
  }, [apiKey]);

  return (
    <div className="relative w-full h-[480px] lg:h-full min-h-[420px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-900">
      {/* Map Header Status Bar */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700 text-slate-300 shadow-md flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {useGoogleMaps ? 'Engine: Google Maps' : 'Engine: Leaflet / OpenStreetMap (Keyless)'}
        </span>
      </div>

      {/* Interactive Map Render */}
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((loc) => {
          const lat = Number(loc.latitude);
          const lng = Number(loc.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={loc.id}
              position={[lat, lng]}
              icon={customParkingIcon}
              eventHandlers={{
                click: () => {
                  if (onSelectLocation) onSelectLocation(loc);
                },
              }}
            >
              <Popup className="custom-popup">
                <div className="p-1 min-w-[200px] text-slate-900">
                  <h4 className="font-bold text-sm text-slate-950 mb-1">{loc.name}</h4>
                  <p className="text-xs text-slate-600 mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                    {loc.address}, {loc.city}
                  </p>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                    <span className="font-bold text-emerald-700">
                      ${Number(loc.hourly_rate).toFixed(2)}/hr
                    </span>
                    <span className="text-slate-500 font-medium">
                      {loc.available_slots || loc.total_slots} slots avail
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/locations/${loc.id}`}
                      className="flex-1 py-1 px-2 text-center text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                    >
                      View & Book
                    </Link>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 rounded"
                      title="Open Directions in Google Maps"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
