export interface VoiceOption {
  name: string;
  accent: string;
  gender: string;
  value: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { name: 'Asteria', accent: 'English (US)', gender: 'Female', value: 'aura-asteria-en' },
  { name: 'Luna', accent: 'English (US)', gender: 'Female', value: 'aura-luna-en' },
  { name: 'Stella', accent: 'English (US)', gender: 'Female', value: 'aura-stella-en' },
  { name: 'Athena', accent: 'English (UK)', gender: 'Female', value: 'aura-athena-en' },
  { name: 'Hera', accent: 'English (US)', gender: 'Female', value: 'aura-hera-en' },
  { name: 'Orion', accent: 'English (US)', gender: 'Male', value: 'aura-orion-en' },
  { name: 'Arcas', accent: 'English (US)', gender: 'Male', value: 'aura-arcas-en' },
  { name: 'Perseus', accent: 'English (US)', gender: 'Male', value: 'aura-perseus-en' },
  { name: 'Angus', accent: 'English (Ireland)', gender: 'Male', value: 'aura-angus-en' },
  { name: 'Orpheus', accent: 'English (US)', gender: 'Male', value: 'aura-orpheus-en' },
  { name: 'Helios', accent: 'English (UK)', gender: 'Male', value: 'aura-helios-en' },
  { name: 'Zeus', accent: 'English (US)', gender: 'Male', value: 'aura-zeus-en' }
];