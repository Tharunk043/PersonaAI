import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Search } from 'lucide-react';

type LatLng = { lat: number; lng: number };

type PhotonResult = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    county?: string;
    district?: string;
    locality?: string;
    osm_value?: string;
    type?: string;
  };
};

type PlaceAutocompleteProps = {
  value: string;
  onChange: (label: string, pos: LatLng | null) => void;
  placeholder?: string;
  iconColor?: string;
};

const PlaceAutocomplete: React.FC<PlaceAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Search for a place...',
  iconColor = 'text-indigo-500'
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PhotonResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }
    setLoading(true);
    try {
      // Photon geocoder — built for autocomplete, supports fuzzy matching, finds villages/hamlets
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`;
      const res = await fetch(photonUrl);
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        setResults(data.features);
        setShowDropdown(true);
      } else {
        // Fallback to Nominatim if Photon returns nothing
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(q)}&addressdetails=1&accept-language=en`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'PersonaAI/1.0' }
        });
        const nomData = await nomRes.json();
        if (Array.isArray(nomData) && nomData.length > 0) {
          // Convert Nominatim results to Photon-like format
          const converted: PhotonResult[] = nomData.map((r: any) => ({
            geometry: { coordinates: [parseFloat(r.lon), parseFloat(r.lat)] },
            properties: {
              name: r.display_name.split(',')[0],
              city: r.address?.city || r.address?.town || r.address?.village,
              state: r.address?.state,
              country: r.address?.country,
              county: r.address?.county,
              district: r.address?.state_district,
            }
          }));
          setResults(converted);
          setShowDropdown(true);
        } else {
          setResults([]);
          setShowDropdown(false);
        }
      }
    } catch (e) {
      console.error('Place search failed:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(val), 300);
  };

  const handleSelect = (result: PhotonResult) => {
    const p = result.properties;
    const [lon, lat] = result.geometry.coordinates;

    // Build clean display name
    const nameParts = [
      p.name,
      p.city || p.district || p.county,
      p.state,
      p.country
    ].filter(Boolean);
    // Remove duplicates (e.g., "Kadapa, Kadapa, Andhra Pradesh")
    const unique = nameParts.filter((v, i, a) => a.indexOf(v) === i);
    const cleanName = unique.join(', ');

    setQuery(cleanName);
    setResults([]);
    setShowDropdown(false);
    onChange(cleanName, { lat, lng: lon });
  };

  const getDisplayParts = (result: PhotonResult) => {
    const p = result.properties;
    const primary = p.name || 'Unknown';
    const secondary = [p.city || p.district || p.county, p.state, p.country]
      .filter(Boolean)
      .filter(v => v !== primary)
      .join(', ');
    return { primary, secondary };
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <MapPin className={`w-5 h-5 ${iconColor} shrink-0`} />
        <div className="relative w-full">
          <input
            className="w-full bg-white dark:bg-gray-800 border-none rounded-xl p-3 pl-3 pr-10 shadow-sm focus:ring-2 focus:ring-indigo-500 text-sm"
            value={query}
            onChange={handleInputChange}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            placeholder={placeholder}
            autoComplete="off"
          />
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-[2000] mt-1 left-7 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map((r, i) => {
            const { primary, secondary } = getDisplayParts(r);
            return (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
              >
                <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{primary}</div>
                  {secondary && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{secondary}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlaceAutocomplete;
