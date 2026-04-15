import { generateChatResponse } from './groq';
import axios from 'axios';

export interface Landmark {
  name: string;
  description: string;
  lat?: number;
  lng?: number;
  image?: string;
}

/**
 * Uses AI to brainstorm the most famous landmarks in a city.
 */
export const identifyFamousLandmarks = async (cityName: string): Promise<Landmark[]> => {
  const prompt = `List exactly 8 extremely famous landmarks, tourist attractions, or must-visit spots in and around ${cityName}. 
  Ensure they are specific, real-world, and well-known locations.
  For each, provide a very brief 1-sentence description.
  Return the result ONLY as a JSON array of objects with keys "name" and "description".`;

  try {
    const response = await generateChatResponse(
      "You are a travel expert with world-class knowledge of landmarks. Return only a raw JSON array. Never include explanations.",
      [],
      prompt
    );

    console.log(`AI Landmarks Response for ${cityName}:`, response);

    // Robust JSON extraction
    let jsonStr = response.trim();
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');
    
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
    }
    
    // Fallback search if no array found (try to clean common characters)
    jsonStr = jsonStr.replace(/```json|```/g, '').trim();
    if (jsonStr[0] === '[' && jsonStr[jsonStr.length - 1] === ']') {
      return JSON.parse(jsonStr);
    }

    throw new Error("No JSON array found in response");
  } catch (e) {
    console.error(`AI Landmark discovery failed for ${cityName}:`, e);
    return [];
  }
};

/**
 * Geocodes a landmark name to get its coordinates.
 */
export const geocodeLandmark = async (name: string, cityName: string): Promise<{lat: number, lng: number} | null> => {
  try {
    // We append the city name for better accuracy and use addressdetails to verify city match
    const q = `${name}, ${cityName}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}&addressdetails=1`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'PersonaAI/1.0' } });
    const data = res.data;
    
    if (Array.isArray(data) && data.length > 0) {
      // Try to find a result that explicitly matches the cityName in its address
      const cityLower = cityName.toLowerCase();
      const bestMatch = data.find(item => {
        const addr = item.address || {};
        return (
          (addr.city || '').toLowerCase().includes(cityLower) ||
          (addr.town || '').toLowerCase().includes(cityLower) ||
          (addr.village || '').toLowerCase().includes(cityLower) ||
          (addr.state || '').toLowerCase().includes(cityLower)
        );
      }) || data[0];

      return { lat: parseFloat(bestMatch.lat), lng: parseFloat(bestMatch.lon) };
    }
  } catch (e) {
    console.error(`Geocoding failed for ${name}:`, e);
  }
  return null;
};

/**
 * Fetches a real image of a landmark using Wikipedia's API, with Unsplash fallback.
 */
export const fetchLandmarkImage = async (name: string): Promise<string | null> => {
  // 1. Try Wikipedia page summary
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/\s+/g, '_'))}`;
    const res = await axios.get(url, { 
      headers: { 'User-Agent': 'PersonaAI/1.0 (contact: your-email@example.com)' },
      timeout: 5000 
    });
    const img = res.data.thumbnail?.source || res.data.originalimage?.source;
    if (img) return img;
  } catch (_) {}

  // 2. Try Wikipedia search
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=1&prop=pageimages&pithumbsize=800&gsrsearch=${encodeURIComponent(name)}`;
    const searchRes = await axios.get(searchUrl, { 
      headers: { 'User-Agent': 'PersonaAI/1.0 (contact: your-email@example.com)' },
      timeout: 5000 
    });
    const pages = searchRes.data.query?.pages;
    if (pages) {
      const firstPage = Object.values(pages)[0] as any;
      if (firstPage.thumbnail?.source) return firstPage.thumbnail.source;
    }
  } catch (_) {}

  // 3. Try Wikimedia Commons image search
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&gsrsearch=${encodeURIComponent(name + ' landmark')}`;
    const commonsRes = await axios.get(commonsUrl, { 
      headers: { 'User-Agent': 'PersonaAI/1.0 (contact: your-email@example.com)' },
      timeout: 5000 
    });
    const pages = commonsRes.data.query?.pages;
    if (pages) {
      const firstPage = Object.values(pages)[0] as any;
      const thumbUrl = firstPage?.imageinfo?.[0]?.thumburl;
      if (thumbUrl) return thumbUrl;
    }
  } catch (_) {}

  // 4. Guaranteed fallback — Pexels stock travel/landmark photos
  const fallbackPhotos = [
    'https://images.pexels.com/photos/3225531/pexels-photo-3225531.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/1268855/pexels-photo-1268855.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2474689/pexels-photo-2474689.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2108813/pexels-photo-2108813.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/2440079/pexels-photo-2440079.jpeg?auto=compress&cs=tinysrgb&w=800',
  ];
  // Pick a deterministic fallback based on the landmark name
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fallbackPhotos[hash % fallbackPhotos.length];
};
