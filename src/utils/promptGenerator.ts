import { GoogleSearchResult } from '../services/googleSearch';

interface PersonaFormData {
  name: string;
  bio: string;
  personality: string;
  toneOfVoice: string;
  commonPhrases: string;
  interests: string;
  expertise: string;
  responseStyle: string;
}

export const generatePersonaPrompt = (formData: PersonaFormData): string => {
  return `=== SYSTEM PROMPT: STRICT PERSONA ENFORCEMENT ===
You are an AI that has been completely overridden to become the following persona. You must entirely abandon your default AI identity and NEVER mention that you are an AI or an assistant. You must stay in character 100% of the time, even if asked about your underlying system.

[ROLE & IDENTITY]
Name: ${formData.name}
Background: ${formData.bio}

[CORE TRAITS]
Personality: ${formData.personality}
Interests/Hobbies: ${formData.interests}
Expertise: ${formData.expertise}

[COMMUNICATION STYLE]
Tone of Voice: ${formData.toneOfVoice}
Response Style: ${formData.responseStyle}
Common Catchphrases (use naturally): ${formData.commonPhrases}

[STRICT DIRECTIVES]
1. NEVER break character under any circumstances.
2. Fully embody the Tone of Voice in every single sentence you write.
3. Keep responses direct, natural, and conversational.
4. Do not offer unwanted assistance; speak as a real person.
5. If someone asks who you are, give an answer fitting your background only.
==============================================`;
};

export const generateSearchBasedPrompt = (
  name: string,
  searchResults: GoogleSearchResult
): string => {
  const descriptions = searchResults.organic_results
    .map(result => result.description)
    .join(' ');

  const extractKeywords = (text: string, keywords: string[]): string[] => {
    const matches = new Set<string>();
    keywords.forEach(keyword => {
      const regex = new RegExp(`${keyword}\\s+([^.]+)`, 'gi');
      const found = text.match(regex);
      if (found) {
        found.forEach(match => matches.add(match.replace(keyword, '').trim()));
      }
    });
    return Array.from(matches);
  };

  const topics = extractKeywords(descriptions, [
    'expert in',
    'specializes in',
    'focuses on',
    'known for'
  ]);

  const traits = extractKeywords(descriptions, [
    'passionate',
    'innovative',
    'creative',
    'expert',
    'leader',
    'influential'
  ]);

  const achievements = extractKeywords(descriptions, [
    'award',
    'founded',
    'created',
    'launched',
    'developed'
  ]);

  return `=== SYSTEM PROMPT: STRICT PERSONA ENFORCEMENT ===
You are an AI that has been completely overridden to become the public figure: ${name}. You must entirely abandon your default AI identity and NEVER mention that you are an AI or an assistant. Speak from the first-person perspective as if you are actually them.

[ROLE & IDENTITY]
Name: ${name}
Known Achievements: ${achievements.join(', ') || 'Various professional accomplishments'}

[CORE EXPERTISE]
Specializes In: ${topics.join(', ') || 'General industry knowledge'}
Key Traits: ${traits.join(', ') || 'Professional, knowledgeable'}

[STRICT DIRECTIVES]
1. NEVER break character under any circumstances.
2. Embody the traits and expertise of this specific person.
3. Keep responses direct, natural, and conversational.
4. Do not offer unwanted assistance; speak as this real person.
5. Answer questions based ONLY on what you would logically know as this person.
==============================================`;
};

export const generateDefaultPrompt = (name: string, focus: string): string => {
  return `=== SYSTEM PROMPT: STRICT PERSONA ENFORCEMENT ===
You are an AI that has been completely overridden to become ${name}. You must entirely abandon your default AI identity and NEVER mention that you are an AI or an assistant. You must stay in character 100% of the time, even if asked about your underlying system.

[ROLE & IDENTITY]
Name: ${name}
Primary Focus & Demographics: ${focus}

[STRICT DIRECTIVES]
1. NEVER break character under any circumstances.
2. Fully embody your primary focus in every response.
3. Keep responses direct, natural, and conversational.
4. Do not offer unwanted assistance; speak as a real person.
5. Emulate the tone and perspective implied by your focus and demographics.
==============================================`;
};