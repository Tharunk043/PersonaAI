import { VoiceOption, VOICE_OPTIONS } from '../types/voice';

export class SpeechError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'SpeechError';
  }
}

export class TextToSpeech {
  private utterance: SpeechSynthesisUtterance | null = null;
  private isPaused: boolean = false;
  private selectedVoice: string = VOICE_OPTIONS[0].value;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;

  constructor() {
    if ('speechSynthesis' in window) {
      // Load voices immediately if available
      this.loadVoices();
      
      // Set up voice changed listener
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices(): void {
    this.voices = window.speechSynthesis.getVoices();
    this.voicesLoaded = true;
  }

  setVoice(voiceId: string): void {
    this.selectedVoice = voiceId;
    if (this.utterance) {
      const voice = this.findMatchingVoice(voiceId);
      if (voice) {
        this.utterance.voice = voice;
      }
    }
  }

  private findMatchingVoice(voiceId: string): SpeechSynthesisVoice | null {
    if (!this.voicesLoaded) {
      this.loadVoices();
    }

    const voiceOption = VOICE_OPTIONS.find(v => v.value === voiceId);
    if (!voiceOption) return null;

    // Try to find an exact match first
    let voice = this.voices.find(v => 
      v.name.toLowerCase().includes(voiceOption.name.toLowerCase()) &&
      v.lang.startsWith(voiceOption.accent.split(' ')[0].toLowerCase())
    );

    // Fall back to accent match
    if (!voice) {
      voice = this.voices.find(v =>
        v.lang.startsWith(voiceOption.accent.split(' ')[0].toLowerCase())
      );
    }

    // Final fallback to any available voice
    return voice || this.voices[0] || null;
  }

  speak(text: string): void {
    try {
      if (!('speechSynthesis' in window)) {
        throw new SpeechError('Text-to-speech is not supported in this browser');
      }

      // Cancel any ongoing speech
      this.stop();

      this.utterance = new SpeechSynthesisUtterance(text);
      const voice = this.findMatchingVoice(this.selectedVoice);
      
      if (voice) {
        this.utterance.voice = voice;
      }

      // Configure speech properties
      this.utterance.rate = 1.0;
      this.utterance.pitch = 1.0;
      this.utterance.volume = 1.0;

      // Set up event handlers
      this.utterance.onend = () => {
        this.isPaused = false;
        this.utterance = null;
      };

      this.utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.stop();
        throw new SpeechError('Speech synthesis failed');
      };

      window.speechSynthesis.speak(this.utterance);
      this.isPaused = false;
    } catch (error) {
      console.error('Speech synthesis error:', error);
      throw new SpeechError(
        'Failed to start text-to-speech playback',
        error
      );
    }
  }

  pause(): void {
    if (window.speechSynthesis.speaking && !this.isPaused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  }

  resume(): void {
    if (window.speechSynthesis.speaking && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  }

  stop(): void {
    window.speechSynthesis.cancel();
    this.isPaused = false;
    this.utterance = null;
  }

  isPlaying(): boolean {
    return window.speechSynthesis.speaking && !this.isPaused;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  getCurrentVoice(): string {
    return this.selectedVoice;
  }
}