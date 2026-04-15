import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

type LatLng = { lat: number; lng: number };
type POI = { lat: number; lng: number; name: string; kind: 'hotel' | 'food' | 'attraction' };

type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
};

type Props = {
  origin: LatLng | null;
  destinations: (LatLng | null)[];
  hotels?: POI[];
  food?: POI[];
  attractions?: POI[];
  onRoute?: (s: RouteSummary) => void;
  transportMode?: 'car' | 'train' | 'plane';
  routePath?: [number, number][];
};

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const divIcon = (emoji: string) =>
  L.divIcon({
    html: `<div style="font-size:20px;line-height:20px">${emoji}</div>`,
    className: 'emoji-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const hotelIcon = divIcon('🏨');
const foodIcon = divIcon('🍽️');
const attractionIcon = divIcon('✨');
const carIcon = divIcon('🚗');
const trainIcon = divIcon('🚆');
const planeIcon = divIcon('✈️');

/**
 * Inline routing — manages OSRM routing control.
 * Uses a stable string key so it only rebuilds when actual coordinates change.
 * Wrapped in try-catch + setTimeout to survive React re-render timing issues.
 */
const InlineRouting: React.FC<{
  wpKey: string;
  origin: LatLng | null;
  destinations: (LatLng | null)[];
  onRoute?: (s: RouteSummary) => void;
}> = ({ wpKey, origin, destinations, onRoute }) => {
  const map = useMap();
  const controlRef = useRef<L.Routing.Control | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    if (!map || !wpKey) return;

    // Clean up previous control
    const oldControl = controlRef.current;
    if (oldControl) {
      controlRef.current = null;
      try { map.removeControl(oldControl); } catch (_) {}
    }

    if (!origin) return;
    const valid = destinations.filter((d): d is LatLng => d !== null);
    if (valid.length === 0) return;

    const waypoints = [
      L.latLng(origin.lat, origin.lng),
      ...valid.map(d => L.latLng(d.lat, d.lng))
    ];

    // Defer control creation to let React finish rendering
    const timer = setTimeout(() => {
      try {
        if (!map || !map.getContainer()) return;
        
        const control = L.Routing.control({
          waypoints,
          routeWhileDragging: false,
          fitSelectedRoutes: false,
          show: false,
          addWaypoints: false,
          router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
          lineOptions: {
            styles: [{ color: '#4F46E5', weight: 5, opacity: 0.85 }],
            extendToWaypoints: true,
            missingRouteTolerance: 0,
          } as L.Routing.LineOptions,
        });

        control.addTo(map);

        // Hide the itinerary container
        const container = (control as any).getContainer?.();
        if (container) container.style.display = 'none';

        (control as any).on('routesfound', (e: any) => {
          const first = e.routes?.[0];
          if (!first || !onRouteRef.current) return;
          onRouteRef.current({
            distanceMeters: first.summary?.totalDistance ?? 0,
            durationSeconds: first.summary?.totalTime ?? 0,
            coordinates: (first.coordinates || []).map((c: any) => [c.lat, c.lng]),
          });
        });

        controlRef.current = control;
      } catch (err) {
        console.warn('Routing control init failed (will retry on next change):', err);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (controlRef.current) {
        try { map.removeControl(controlRef.current); } catch (_) {}
        controlRef.current = null;
      }
    };
  }, [map, wpKey]);

  return null;
};

/**
 * Fits map bounds to include all markers and POIs.
 */
const FitBounds: React.FC<{ 
  boundsKey: string;
  origin: LatLng | null; 
  destinations: (LatLng | null)[];
  hotels: POI[];
  food: POI[];
  attractions: POI[];
}> = ({ boundsKey, origin, destinations, hotels, food, attractions }) => {
  const map = useMap();

  useEffect(() => {
    if (!boundsKey) return;
    const markers: L.LatLng[] = [];
    if (origin) markers.push(L.latLng(origin.lat, origin.lng));
    destinations.filter((d): d is LatLng => d !== null).forEach(d => markers.push(L.latLng(d.lat, d.lng)));
    [...hotels, ...food, ...attractions].forEach(p => markers.push(L.latLng(p.lat, p.lng)));

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      setTimeout(() => map.invalidateSize(), 200);
    }
  }, [map, boundsKey]);

  return null;
};

const RouteMap: React.FC<Props> = ({
  origin,
  destinations,
  hotels = [],
  food = [],
  attractions = [],
  onRoute,
  transportMode = 'car',
  routePath,
}) => {
  const center: LatLng = destinations.find(d => d !== null) as LatLng ?? origin ?? { lat: 20.5937, lng: 78.9629 };

  // Stable string key for waypoints — prevents unnecessary rerenders
  const wpKey = useMemo(() => {
    if (!origin) return '';
    const valid = destinations.filter((d): d is LatLng => d !== null);
    if (valid.length === 0) return '';
    return [origin, ...valid].map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  }, [
    origin?.lat, origin?.lng,
    destinations.map(d => d ? `${d.lat.toFixed(5)},${d.lng.toFixed(5)}` : '').join('|'),
  ]);

  // Stable string key for bounds
  const boundsKey = useMemo(() => {
    const parts: string[] = [];
    if (origin) parts.push(`o:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`);
    destinations.forEach((d, i) => {
      if (d) parts.push(`d${i}:${d.lat.toFixed(4)},${d.lng.toFixed(4)}`);
    });
    parts.push(`p:${hotels.length},${food.length},${attractions.length}`);
    return parts.join('|');
  }, [
    origin?.lat, origin?.lng,
    destinations.map(d => d ? `${d.lat.toFixed(4)},${d.lng.toFixed(4)}` : '').join('|'),
    hotels.length, food.length, attractions.length,
  ]);

  const midPoint = useMemo(() => {
    if (!routePath?.length) return null;
    const idx = Math.floor(routePath.length / 2);
    return { lat: routePath[idx][0], lng: routePath[idx][1] };
  }, [routePath]);

  const modeIcon = useMemo(() => {
    if (transportMode === 'plane') return planeIcon;
    if (transportMode === 'train') return trainIcon;
    return carIcon;
  }, [transportMode]);

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-[1000] rounded-lg bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 shadow px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span>🚗/🚆/✈️ Travel</span>
          <span>🏨 Hotels</span>
          <span>🍽️ Dining</span>
          <span>✨ Sights</span>
        </div>
      </div>

      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={6} 
        style={{ height: '70vh', width: '100%' }} 
        scrollWheelZoom
      >
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {origin && <Marker position={[origin.lat, origin.lng]}><Popup>📍 Origin</Popup></Marker>}
        {destinations.map((d, idx) => d && (
          <Marker key={`dest-${idx}`} position={[d.lat, d.lng]}>
            <Popup>📍 Stop {idx + 1}</Popup>
          </Marker>
        ))}

        {routePath && routePath.length > 1 && (
          <Polyline positions={routePath as any} pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.4, dashArray: '10 6' }} />
        )}

        {midPoint && <Marker position={[midPoint.lat, midPoint.lng]} icon={modeIcon} />}

        {hotels.map((h, i) => (
          <Marker key={`h-${i}`} position={[h.lat, h.lng]} icon={hotelIcon}><Popup>🏨 {h.name}</Popup></Marker>
        ))}
        {food.map((f, i) => (
          <Marker key={`f-${i}`} position={[f.lat, f.lng]} icon={foodIcon}><Popup>🍽️ {f.name}</Popup></Marker>
        ))}
        {attractions.map((a, i) => (
          <Marker key={`a-${i}`} position={[a.lat, a.lng]} icon={attractionIcon}><Popup>✨ {a.name}</Popup></Marker>
        ))}

        {/* Route line — deferred init to avoid React timing conflicts */}
        <InlineRouting wpKey={wpKey} origin={origin} destinations={destinations} onRoute={onRoute} />

        <FitBounds 
          boundsKey={boundsKey}
          origin={origin} 
          destinations={destinations} 
          hotels={hotels} 
          food={food} 
          attractions={attractions} 
        />
      </MapContainer>
    </div>
  );
};

export default RouteMap;
