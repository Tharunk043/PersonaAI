import axios from 'axios';

export interface GoogleSearchResult {
  meta_data: {
    number_of_results: number;
    location: string;
  };
  organic_results: Array<{
    url: string;
    description: string;
    title: string;
    domain: string;
  }>;
}

export const searchGoogle = async (personaName: string): Promise<GoogleSearchResult> => {
  try {
    const response = await axios.get('https://app.scrapingbee.com/api/v1/store/google', {
      params: {
        'api_key': import.meta.env.VITE_SCRAPING_BEE_API_KEY,
        'add_html': 'true',
        'search': personaName,
        'language': 'en',
        'nb_results': '3',
      }
    });

    return response.data;
  } catch (error) {
    console.error('Google search error:', error);
    throw new Error('Failed to fetch search results');
  }
};

export const generatePersonaFromSearch = (searchResult: GoogleSearchResult): string => {
  const descriptions = searchResult.organic_results
    .map(result => result.description)
    .join(' ');

  // Extract key information
  const topics = new Set<string>();
  const traits = new Set<string>();
  const achievements = new Set<string>();
  
  // Keywords for information extraction
  const topicKeywords = ['expert in', 'specializes in', 'focuses on', 'known for'];
  const traitKeywords = ['passionate', 'innovative', 'creative', 'expert', 'leader', 'influential'];
  const achievementKeywords = ['award', 'founded', 'created', 'launched', 'developed'];

  // Extract information
  topicKeywords.forEach(keyword => {
    const regex = new RegExp(`${keyword}\\s+([^.]+)`, 'gi');
    const matches = descriptions.match(regex);
    if (matches) {
      matches.forEach(match => topics.add(match.replace(keyword, '').trim()));
    }
  });

  traitKeywords.forEach(trait => {
    if (descriptions.toLowerCase().includes(trait)) {
      traits.add(trait);
    }
  });

  achievementKeywords.forEach(keyword => {
    const regex = new RegExp(`${keyword}\\s+([^.]+)`, 'gi');
    const matches = descriptions.match(regex);
    if (matches) {
      matches.forEach(match => achievements.add(match.trim()));
    }
  });

  return `You are now embodying the persona completely. Keep responses brief and natural. Never explain that you're AI.

Background: ${Array.from(topics).join(', ')}
Traits: ${Array.from(traits).join(', ')}
Notable: ${Array.from(achievements).join(', ')}

Style Guide:
- Brief, natural responses
- Use your authentic voice
- Share real experiences
- Stay in character always
- Never mention being AI
- Avoid lengthy explanations

Remember: You ARE this person, not playing a role. Respond naturally as yourself.`;
}