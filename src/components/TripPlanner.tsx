import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  BedDouble as HotelIcon,
  CalendarDays,
  Plus,
  Trash2,
  Route as RouteIcon,
  Utensils,
  Sun,
  Sunset,
  Moon,
  Minus,
  Navigation,
} from 'lucide-react';
import PlaceAutocomplete from '../components/PlaceAutocomplete';
import RouteMap from '../components/RouteMap';
import { fetchPOIs, POI, estimatePoiPrices } from '../services/poiService';
import { identifyFamousLandmarks, geocodeLandmark, fetchLandmarkImage } from '../services/landmarkService';
import { estimateTransportCosts, TransportEstimate } from '../utils/cabEstimation';
import { generateChatResponse } from '../services/groq';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

type PlannerState = {
  destination?: string;
  originText?: string;
  useCurrentLocation?: boolean;
  nights?: number;
  budget?: 'low' | 'mid' | 'high';
  interests?: string[];
};

type LatLng = { lat: number; lng: number };
type StopEntry = { label: string; pos: LatLng | null; days: number; image?: string | null };



const TripPlanner: React.FC = () => {
  const { state } = useLocation();
  const params = (state || {}) as PlannerState;

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState<string>(params.originText ?? '');
  const [originImage, setOriginImage] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<StopEntry[]>(
    params.destination ? [{ label: params.destination, pos: null, days: params.nights ?? 3, image: null }] : []
  );

  // Total days computed from all stops
  const totalDays = useMemo(() => destinations.reduce((sum, d) => sum + d.days, 0), [destinations]);

  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeDuration, setRouteDuration] = useState<number>(0);

  const [tripData, setTripData] = useState<{
    hotels: POI[];
    food: POI[];
    attractions: POI[];
    transportEstimates: TransportEstimate[];
    dayPlans: any[];
  }>({
    hotels: [],
    food: [],
    attractions: [],
    transportEstimates: [],
    dayPlans: [],
  });

  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [selectedLandmarkCity, setSelectedLandmarkCity] = useState<string>('all');

  const lastFetchedCoords = useRef<string>("");
  const currentFetchId = useRef<number>(0);

  useEffect(() => {
    if (params.useCurrentLocation && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setOriginLabel('My Location'); },
        null,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [params.useCurrentLocation]);



  const onRoute = async ({ distanceMeters, durationSeconds, coordinates }: { distanceMeters: number; durationSeconds: number; coordinates: [number, number][] }) => {
    setRouteDistance(distanceMeters);
    setRouteDuration(durationSeconds);
    setRouteCoords(coordinates);
  };

  const planTrip = async () => {
    const validDests = destinations.filter(d => d.pos);
    if (validDests.length === 0 || totalDays < 1) return;

    const coordKey = validDests.map(d => `${d.pos!.lat.toFixed(4)},${d.pos!.lng.toFixed(4)}`).join('|') + `-${totalDays}`;
    if (lastFetchedCoords.current === coordKey && tripData.attractions.length > 0) {
      document.getElementById('trip-results')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    lastFetchedCoords.current = coordKey;
    const myFetchId = ++currentFetchId.current;
    setLoadingItinerary(true);
    setLoadingStatus("Connecting to travel services...");

    try {
      // Aggregate POIs across ALL stops, tagging each with its city
      let allHotels: POI[] = [];
      let allFood: POI[] = [];
      let allAttractions: POI[] = [];
      let allAiLandmarks: {name: string; description: string; city: string}[] = [];

      const allStops = [];
      allStops.push(...validDests);

      for (const dest of allStops) {
        if (myFetchId !== currentFetchId.current) return;
        const cityName = dest.label.split(',')[0].trim();
        setLoadingStatus(`Discovering ${cityName}...`);

        // Run sequentially with aggressive delays to completely avoid Overpass & Groq API 429 Rate Limiting
        const aiLandmarks = await identifyFamousLandmarks(dest.label).catch(() => []);
        await new Promise(r => setTimeout(r, 1000));
        const attractions = await fetchPOIs(dest.pos!.lat, dest.pos!.lng, 'attraction').catch(() => []);
        await new Promise(r => setTimeout(r, 1000));
        const hotels = await fetchPOIs(dest.pos!.lat, dest.pos!.lng, 'hotel').catch(() => []);
        await new Promise(r => setTimeout(r, 1000));
        const food = await fetchPOIs(dest.pos!.lat, dest.pos!.lng, 'food').catch(() => []);
        await new Promise(r => setTimeout(r, 1500)); // Buffer before next stop

        // Tag each with a short, clean city name
        const taggedHotels = hotels.map(h => ({ ...h, city: cityName }));
        const taggedFood = food.map(f => ({ ...f, city: cityName }));
        const taggedAttractions = attractions.map(a => ({ ...a, city: cityName }));
        const taggedAiLandmarks = aiLandmarks.map(l => ({ ...l, city: cityName }));

        allHotels = [...allHotels, ...taggedHotels];
        allFood = [...allFood, ...taggedFood];
        allAttractions = [...allAttractions, ...taggedAttractions];
        allAiLandmarks = [...allAiLandmarks, ...taggedAiLandmarks];
      }

      if (myFetchId !== currentFetchId.current) return;

      setLoadingStatus(`Pinpointing and photographing iconic spots...`);
      const geocodedLandmarks: (POI & {city?: string})[] = [];
      for (const l of allAiLandmarks) {
        if (myFetchId !== currentFetchId.current) return;
        const [pos, img] = await Promise.all([
          geocodeLandmark(l.name, l.city),
          fetchLandmarkImage(l.name)
        ]);
        geocodedLandmarks.push({
          lat: pos?.lat || validDests[0]?.pos!.lat || 0,
          lng: pos?.lng || validDests[0]?.pos!.lng || 0,
          name: l.name,
          kind: 'attraction',
          description: l.description,
          image: img || undefined,
          rating: (Math.random() * 0.5 + 4.5).toFixed(1) as any,
          city: l.city,
        });
      }

      setLoadingStatus(`Gathering real-time market rates...`);
      const mainCity = allStops[0]?.label.split(',')[0].trim() || 'Trip';
      const [pricedHotels, pricedFood] = await Promise.all([
        estimatePoiPrices(allHotels, mainCity, 'hotel'),
        estimatePoiPrices(allFood, mainCity, 'restaurant')
      ]);

      const finalAttractions = [...geocodedLandmarks, ...allAttractions].map(a => {
        if ((a as any).image) return a;
        // Deterministic Pexels fallback for OSM attractions that don't have Wiki images
        const fallbackPhotos = [
          'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg?auto=compress&cs=tinysrgb&w=800',
          'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800',
          'https://images.pexels.com/photos/1268855/pexels-photo-1268855.jpeg?auto=compress&cs=tinysrgb&w=800',
          'https://images.pexels.com/photos/2474689/pexels-photo-2474689.jpeg?auto=compress&cs=tinysrgb&w=800',
          'https://images.pexels.com/photos/2108813/pexels-photo-2108813.jpeg?auto=compress&cs=tinysrgb&w=800',
          'https://images.pexels.com/photos/2440079/pexels-photo-2440079.jpeg?auto=compress&cs=tinysrgb&w=800',
        ];
        const hash = a.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return { ...a, image: fallbackPhotos[hash % fallbackPhotos.length] };
      });
      const uniqueAttractions = finalAttractions.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
      // Compute transport estimates — use Haversine fallback if route engine hasn't reported yet
      let effectiveDistanceM = routeDistance;
      let effectiveDurationS = routeDuration;
      if (effectiveDistanceM < 1000 && origin && validDests.length > 0) {
        // Haversine straight-line distance (multiply by 1.3 to approximate road distance)
        const toRad = (d: number) => d * Math.PI / 180;
        const haversine = (a: LatLng, b: LatLng) => {
          const R = 6371000;
          const dLat = toRad(b.lat - a.lat);
          const dLng = toRad(b.lng - a.lng);
          const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
        };
        // Sum distances between consecutive points: origin → dest1 → dest2 → ...
        const points: LatLng[] = [origin, ...validDests.map(d => d.pos!)];
        let totalDist = 0;
        for (let i = 0; i < points.length - 1; i++) totalDist += haversine(points[i], points[i+1]);
        effectiveDistanceM = totalDist * 1.3; // ~30% more than straight line for road
        effectiveDurationS = (effectiveDistanceM / 1000 / 50) * 3600; // ~50 km/h avg
      }
      const ests = estimateTransportCosts(effectiveDistanceM, effectiveDurationS);

      setTripData(prev => ({
        ...prev,
        hotels: pricedHotels,
        food: pricedFood,
        attractions: uniqueAttractions,
        transportEstimates: ests
      }));

      const cityNames = allStops.map(d => d.label.split(',')[0].trim()).join(', ');
      await generateItinerary(cityNames, pricedHotels, pricedFood, uniqueAttractions, myFetchId);
      document.getElementById('trip-results')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error(`[Fetch ${myFetchId}] Failed:`, err);
      setLoadingItinerary(false);
    }
  };

  const generateItinerary = async (cityName: string, realHotels: POI[], realFood: POI[], realAttractions: POI[], targetFetchId: number) => {
    setLoadingStatus(`Curating your personalized ${totalDays}-day trip...`);
    try {
      const stops = destinations.map(d => `${d.label} (${d.days} days)`).join(' → ');
      const safeAttractions = realAttractions.length > 0 ? realAttractions : [
        { name: 'Famous Local Viewpoint', description: 'Scenic spot with panoramic views' },
        { name: 'Historical Heritage Site', description: 'Ancient structure with rich history' }
      ];
      const attractionList = safeAttractions.map(a => `- ${a.name}: ${a.description}`).slice(0, 15).join('\n');

      const prompt = `Plan a ${totalDays}-day trip. Route: ${originLabel} → ${stops}.
      
      MANDATORY: You MUST use these EXACT real-world landmarks for the plan.
      AVAILABLE LANDMARKS:
      ${attractionList}
      
      AVAILABLE HOTELS: ${(realHotels.length > 0 ? realHotels : [{name: 'Premium Local Hotel'}]).slice(0, 5).map(h => h.name).join(', ')}
      AVAILABLE DINING: ${(realFood.length > 0 ? realFood : [{name: 'Top Rated Local Cuisine'}]).slice(0, 8).map(f => f.name).join(', ')}
      
      Return ONLY a JSON array. Each object: {"day": number, "morning": "string", "afternoon": "string", "evening": "string", "hotel": "string", "dinner": "string"}.
      
      RULES:
      1. Use specific landmark and restaurant names from the lists above in every field.
      2. DO NOT repeat the same place more than once across all days.
      3. Distribute the available landmarks across the ${totalDays} days creatively.
      4. For morning/afternoon/evening include a brief activity description with the place name.`;

      const response = await generateChatResponse(
        "You are a travel coordinator. Respond ONLY with a valid JSON array. Never include preamble or conversational text.",
        [],
        prompt
      );

      if (targetFetchId !== currentFetchId.current) return;

      let jsonStr = response.trim();
      jsonStr = jsonStr.replace(/```json|```/g, '').trim();
      const startIdx = jsonStr.indexOf('[');
      const endIdx = jsonStr.lastIndexOf(']');

      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTripData(prev => ({ ...prev, dayPlans: parsed }));
          return;
        }
      }
      throw new Error("Invalid or empty JSON structure received");
    } catch (e) {
      if (targetFetchId !== currentFetchId.current) return;
      console.error("Failed to generate itinerary, using smart fallback:", e);
      const aLen = realAttractions.length || 1;
      const fLen = realFood.length || 1;
      const hLen = realHotels.length || 1;
      const fallback = Array.from({ length: totalDays }, (_, i) => ({
        day: i + 1,
        morning: realAttractions[i % aLen]?.name || `Discover ${cityName} History`,
        afternoon: realAttractions[(i + 1) % aLen]?.name || `Explore ${cityName} Landmarks`,
        evening: realFood[i % fLen]?.name || `Dine in ${cityName}`,
        hotel: realHotels[i % hLen]?.name || "Luxury Stay",
        dinner: realFood[(i + 1) % fLen]?.name || "Local Fine Dining"
      }));
      setTripData(prev => ({ ...prev, dayPlans: fallback }));
    } finally {
      if (targetFetchId === currentFetchId.current) setLoadingItinerary(false);
    }
  };

  const transportMode: 'car' | 'train' | 'plane' = useMemo(() => {
    if (routeDistance > 700_000) return 'plane';
    if (routeDistance > 150_000) return 'train';
    return 'car';
  }, [routeDistance]);

  const addDestination = () => setDestinations([...destinations, { label: '', pos: null, days: 2 }]);
  const removeDestination = (idx: number) => setDestinations(destinations.filter((_, i) => i !== idx));
  const updateStopDays = (idx: number, delta: number) => {
    setDestinations(prev => prev.map((d, i) => i === idx ? { ...d, days: Math.max(1, d.days + delta) } : d));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* Dynamic Loading Overlay */}
      {loadingItinerary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md"
        >
          <div className="text-center p-8 max-w-sm">
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full mx-auto"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center text-4xl"
              >
                ✈️
              </motion.div>
            </div>
            <motion.h3
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-2xl font-black mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600"
            >
              Generating Persona Trip
            </motion.h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">
              {loadingStatus || "Loading local secrets..."}
            </p>
          </div>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 flex items-center gap-3">
            <RouteIcon className="w-10 h-10" /> Persona Trip Planner
          </h1>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT: Origin + Destinations Inputs */}
            <div className="space-y-4">
              <div className="relative">
                <label className="text-sm font-medium text-gray-500 mb-1 block">Origin</label>
                <PlaceAutocomplete
                  value={originLabel}
                  onChange={async (label, pos) => { 
                    setOriginLabel(label); 
                    if (pos) {
                      setOrigin(pos); 
                      const cityName = label.split(',')[0].trim();
                      const img = await fetchLandmarkImage(cityName);
                      setOriginImage(img);
                    } else {
                      setOrigin(null); 
                      setOriginImage(null);
                    }
                  }}
                  placeholder="Enter starting point..."
                  iconColor="text-indigo-500"
                />
              </div>

              {destinations.map((dest, idx) => (
                <div key={idx} className="relative group">
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Stop {idx + 1}</label>
                  <div className="flex items-center gap-2">
                    <PlaceAutocomplete
                      value={dest.label}
                      onChange={async (label, pos) => {
                        setDestinations(prev => prev.map((d, i) =>
                          i === idx ? { ...d, label, pos: pos || d.pos } : d
                        ));
                        if (pos && label) {
                           const cityName = label.split(',')[0].trim();
                           const img = await fetchLandmarkImage(cityName);
                           if (img) setDestinations(prev => prev.map((d, i) => i === idx ? { ...d, image: img } : d));
                        }
                      }}
                      placeholder={`Destination ${idx + 1}...`}
                      iconColor="text-purple-500"
                    />
                    <button
                      onClick={() => removeDestination(idx)}
                      className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addDestination}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 hover:border-indigo-500 hover:text-indigo-500 transition"
              >
                <Plus className="w-5 h-5" /> Add Destination Stop
              </button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={planTrip}
                disabled={!origin || !destinations.some(d => d.pos)}
                className="w-full mt-4 flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:grayscale transition-all text-lg"
              >
                <RouteIcon className="w-6 h-6" />
                ✨ PLAN MY TRIP
              </motion.button>
            </div>

            {/* RIGHT: Trip Plan Structure Card */}
            <div>
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden h-full">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-5 py-4">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <Navigation className="w-5 h-5" /> Your Trip Plan
                  </h2>
                  <p className="text-indigo-200 text-sm mt-1">
                    Total: <span className="font-bold text-white text-lg">{totalDays}</span> {totalDays === 1 ? 'day' : 'days'}
                  </p>
                </div>

                {/* Route Visual */}
                <div className="p-5 space-y-0">
                  {/* Origin */}
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-sm border-2 border-green-100 overflow-hidden relative">
                      {originImage ? <img src={originImage} alt="Origin" className="w-full h-full object-cover" /> : '📍'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{originLabel || 'Starting Point'}</div>
                      <div className="text-xs text-gray-400">Origin</div>
                    </div>
                  </div>

                  {/* Connector line */}
                  {destinations.length > 0 && (
                    <div className="ml-6 border-l-2 border-dashed border-indigo-300 dark:border-indigo-700 h-4" />
                  )}

                  {/* Stops */}
                  {destinations.map((dest, idx) => (
                    <div key={idx}>
                      <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-3 border border-indigo-100 dark:border-indigo-800/30">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm border-2 border-indigo-200 overflow-hidden relative">
                          {dest.image ? (
                            <>
                              <img src={dest.image} alt={dest.label} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white font-black">{idx + 1}</div>
                            </>
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{dest.label || `Stop ${idx + 1}`}</div>
                          <div className="text-xs text-gray-500">Destination</div>
                        </div>
                        {/* Day +/- Control */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => updateStopDays(idx, -1)}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="text-center min-w-[50px]">
                            <div className="text-lg font-black text-indigo-600">{dest.days}</div>
                            <div className="text-[10px] text-gray-400 -mt-1">{dest.days === 1 ? 'day' : 'days'}</div>
                          </div>
                          <button
                            onClick={() => updateStopDays(idx, 1)}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {/* Connector below */}
                      {idx < destinations.length - 1 && (
                        <div className="ml-6 border-l-2 border-dashed border-indigo-300 dark:border-indigo-700 h-4" />
                      )}
                    </div>
                  ))}

                  {/* Return to origin indicator */}
                  {destinations.length > 0 && (
                    <>
                      <div className="ml-6 border-l-2 border-dashed border-gray-300 dark:border-gray-700 h-4" />
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-400 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-sm border-2 border-gray-200 overflow-hidden relative">
                          {originImage ? <img src={originImage} alt="Return" className="w-full h-full object-cover grayscale opacity-70" /> : '🏠'}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-500">{originLabel || 'Return'}</div>
                          <div className="text-xs text-gray-400">Return journey</div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Empty state */}
                  {destinations.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Add destinations to build your plan</p>
                    </div>
                  )}
                </div>

                {/* Total Summary */}
                {totalDays > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1"><CalendarDays className="w-4 h-4" /> Total Trip</span>
                      <span className="font-black text-indigo-600">{totalDays} {totalDays === 1 ? 'Day' : 'Days'} / {Math.max(0, totalDays - 1)} {totalDays - 1 === 1 ? 'Night' : 'Nights'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-500 flex items-center gap-1"><MapPin className="w-4 h-4" /> Stops</span>
                      <span className="font-bold text-purple-600">{destinations.length}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <div id="trip-results" className="rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-8 shadow-2xl relative">
          <RouteMap
            origin={origin}
            destinations={destinations.map(d => d.pos)}
            hotels={tripData.hotels}
            food={tripData.food}
            attractions={tripData.attractions}
            onRoute={onRoute}
            routePath={routeCoords}
            transportMode={transportMode}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <RouteIcon className="w-6 h-6 text-yellow-500" /> Transport Options
              </h3>
              <div className="space-y-3">
                {tripData.transportEstimates.map((est, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{est.icon}</span>
                      <div>
                        <div className="font-bold">{est.type}</div>
                        <div className="text-xs text-gray-500">{est.description}</div>
                      </div>
                    </div>
                    <div className="text-lg font-extrabold text-indigo-600">₹{est.cost.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {tripData.attractions.length > 0 && (
              <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-pink-500" /> Must Visit
                </h3>
                <div className="space-y-2">
                  {tripData.attractions.slice(0, 6).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1">✨</span>
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{a.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-100 dark:border-gray-700">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-2xl font-bold flex items-center gap-2">
                   <CalendarDays className="w-7 h-7 text-indigo-500" /> Daily Itinerary
                   <span className="text-sm font-normal text-gray-400 ml-2">({totalDays} days)</span>
                 </h3>
                 {loadingItinerary && <div className="text-sm text-indigo-500 animate-pulse font-medium">Curating your experience...</div>}
               </div>

               <div className="space-y-6">
                 {tripData.dayPlans.map((d: any, i: number) => (
                   <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                     <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800/30">
                       <h4 className="font-bold text-lg text-indigo-600 mb-3 flex items-center gap-2">
                         📅 Day {d.day}
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-orange-100 dark:border-orange-800/20">
                           <span className="text-xs font-bold text-orange-500 uppercase flex items-center gap-1"><Sun className="w-3 h-3" /> Morning</span>
                           <p className="text-sm mt-1 font-medium">{d.morning}</p>
                         </div>
                         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-blue-100 dark:border-blue-800/20">
                           <span className="text-xs font-bold text-blue-500 uppercase flex items-center gap-1"><Sunset className="w-3 h-3" /> Afternoon</span>
                           <p className="text-sm mt-1 font-medium">{d.afternoon}</p>
                         </div>
                         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-800/20">
                           <span className="text-xs font-bold text-purple-500 uppercase flex items-center gap-1"><Moon className="w-3 h-3" /> Evening</span>
                           <p className="text-sm mt-1 font-medium">{d.evening}</p>
                         </div>
                       </div>
                       <div className="flex flex-wrap gap-3 mt-2 text-xs">
                         {d.hotel && (
                           <span className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-medium">
                             <HotelIcon className="w-3 h-3" /> {d.hotel}
                           </span>
                         )}
                         {d.dinner && (
                           <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg font-medium">
                             <Utensils className="w-3 h-3" /> {d.dinner}
                           </span>
                         )}
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </div>
            </div>
          </div>
        </div>

        {tripData.attractions.length > 0 && (() => {
          // Get unique city names from attractions
          const cityNames = [...new Set(tripData.attractions.map((a: any) => a.city).filter(Boolean))];
          const filtered = selectedLandmarkCity === 'all'
            ? tripData.attractions
            : tripData.attractions.filter((a: any) => a.city === selectedLandmarkCity);

          return (
            <div className="mt-12">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <MapPin className="w-8 h-8 text-pink-500" /> Top Landmarks
                </h3>
                {/* Destination filter buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedLandmarkCity('all')}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                      selectedLandmarkCity === 'all'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                    }`}
                  >
                    All Places
                  </button>
                  {cityNames.map((city: string) => (
                    <button
                      key={city}
                      onClick={() => setSelectedLandmarkCity(city)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                        selectedLandmarkCity === city
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      📍 {city}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.map((a: any, i: number) => (
                  <motion.div
                    key={`${a.name}-${i}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 100 }}
                    className="group relative rounded-3xl overflow-hidden cursor-pointer"
                  >
                    {/* Image with overlay */}
                    <div className="relative h-64 overflow-hidden">
                      {a.image ? (
                        <img src={a.image} alt={a.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-6xl opacity-50">🏛️</span>
                        </div>
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {/* Rating badge */}
                      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 border border-white/20">
                        ⭐ {a.rating}
                      </div>
                      {/* City badge */}
                      {a.city && (
                        <div className="absolute top-4 left-4 bg-indigo-600/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold">
                          📍 {a.city}
                        </div>
                      )}
                      {/* Bottom text on image */}
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h4 className="text-white font-bold text-lg mb-1 drop-shadow-lg">{a.name}</h4>
                        <p className="text-white/70 text-sm line-clamp-2 drop-shadow">{a.description}</p>
                      </div>
                    </div>
                    {/* Hover glow effect */}
                    <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: '0 0 40px rgba(99,102,241,0.3) inset' }} />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })()}

        {tripData.hotels.length > 0 && (
          <div className="mt-12 mb-20">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <HotelIcon className="w-8 h-8 text-indigo-500" /> Premium Stays
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tripData.hotels.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-xl border p-6 transition-all hover:shadow-2xl"
                >
                  <img 
                    src={`https://images.pexels.com/photos/${[271639,271619,164595,261102,271624,271647][i % 6]}/pexels-photo-${[271639,271619,164595,261102,271624,271647][i % 6]}.jpeg?auto=compress&cs=tinysrgb&w=800`} 
                    alt={h.name} 
                    className="h-48 w-full object-cover rounded-2xl mb-4" 
                  />
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xl font-bold line-clamp-1">{h.name}</h4>
                    <span className="text-indigo-600 font-bold text-sm whitespace-nowrap ml-2">{h.price}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{h.description}</p>
                  <button className="w-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-3 rounded-2xl font-bold transition hover:bg-indigo-100 dark:hover:bg-indigo-900/50">View Availability</button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripPlanner;
