import axios from 'axios';

export interface POI {
  lat: number;
  lng: number;
  name: string;
  kind: 'hotel' | 'food' | 'attraction';
  description?: string;
  image?: string;
  price?: string;
  rating?: number;
}

/**
 * Fetches real POIs (hotels, restaurants, or attractions) using OpenStreetMap's Overpass API.
 */
export const fetchPOIs = async (lat: number, lng: number, kind: 'hotel' | 'food' | 'attraction', radius = 5000): Promise<POI[]> => {
  let amenity = '';
  let tourism = '';
  
  if (kind === 'hotel') {
    amenity = 'hotel|guest_house|hostel';
    tourism = 'hotel|guest_house|hostel|apartment';
  } else if (kind === 'food') {
    amenity = 'restaurant|cafe|fast_food|bar|pub';
  } else if (kind === 'attraction') {
    tourism = 'attraction|museum|viewpoint|zoo|theme_park|gallery|monument';
    amenity = 'theatre|cinema|arts_centre';
  }

  // Increase radius for rural areas if it's an attraction search
  const searchRadius = kind === 'attraction' ? 15000 : radius;

  const query = `
    [out:json][timeout:25];
    (
      ${amenity ? `node["amenity"~"${amenity}"](around:${searchRadius},${lat},${lng});` : ''}
      ${amenity ? `way["amenity"~"${amenity}"](around:${searchRadius},${lat},${lng});` : ''}
      ${tourism ? `node["tourism"~"${tourism}"](around:${searchRadius},${lat},${lng});` : ''}
      ${tourism ? `way["tourism"~"${tourism}"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `node["historic"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `way["historic"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `way["natural"~"waterfall|peak|beach|wood|glacier|volcano"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `node["leisure"~"park|garden|nature_reserve"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `way["leisure"~"park|garden|nature_reserve"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `node["landuse"~"orchard|vineyard|plantations"](around:${searchRadius},${lat},${lng});` : ''}
      ${kind === 'attraction' ? `way["landuse"~"orchard|vineyard|plantations"](around:${searchRadius},${lat},${lng});` : ''}
    );
    out center;
  `;

  try {
    const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`);
    const elements = response.data.elements || [];

    return elements
      .map((el: any) => {
        const tags = el.tags || {};
        const name = tags.name || tags['name:en'] || null;
        if (!name) return null;

        const point = el.type === 'node' ? { lat: el.lat, lng: el.lon } : { lat: el.center.lat, lng: el.center.lon };
        
        return {
          ...point,
          name,
          kind,
          description: tags.description || tags.comment || `${name} - A popular ${kind} spot in the area.`,
          rating: tags.stars || tags.rating || (Math.random() * 1.5 + 3.5).toFixed(1),
          price: tags.price || tags['payment:cash'] ? '₹₹' : '₹₹₹',
        };
      })
      .filter((poi: any): poi is POI => poi !== null && poi.name && !poi.name.toLowerCase().includes('unnamed') && poi.name !== 'Local Interest')
      .sort(() => 0.5 - Math.random()) // Randomize slightly for variety
      .slice(0, 10);
  } catch (error) {
    console.error('Error fetching POIs from Overpass:', error);
    return [];
  }
};

/**
 * Uses AI to estimate real-time pricing for a list of hotels.
 */
export const estimatePoiPrices = async (pois: POI[], cityName: string, kind: string): Promise<POI[]> => {
  if (pois.length === 0) return [];
  
  const poiNames = pois.map(p => p.name).join(', ');
  const prompt = `For these specifically named ${kind}s in ${cityName}: ${poiNames}.
  Provide a real-time nightly price estimate (or average meal cost if dining) in local currency (INR if in India, else USD).
  Return ONLY a JSON object mapping the name to a string like "₹4,500/night" or "₹800/person".`;

  try {
    const { generateChatResponse } = await import('./groq');
    const response = await generateChatResponse(
      "You are a local pricing expert. Return raw JSON mapping names to prices.",
      [],
      prompt
    );

    const startIdx = response.indexOf('{');
    const endIdx = response.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      const priceMap = JSON.parse(response.substring(startIdx, endIdx + 1));
      return pois.map(p => ({
        ...p,
        price: priceMap[p.name] || p.price
      }));
    }
  } catch (e) {
    console.warn("Price estimation failed, using defaults");
  }
  return pois;
};
