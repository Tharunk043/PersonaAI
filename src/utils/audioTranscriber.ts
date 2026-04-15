export class TranscriptionError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
}

export class AudioTranscriber {
  private readonly apiUrl = 'https://api.deepgram.com/v1/listen';
  private readonly apiKey: string;

  constructor() {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new TranscriptionError('Missing Deepgram API key');
    }
    this.apiKey = apiKey;
  }

  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      if (!audioBlob || audioBlob.size === 0) {
        throw new TranscriptionError('Invalid audio data');
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(`${this.apiUrl}?model=nova-2&smart_format=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new TranscriptionError(`API error: ${response.status}`);
      }

      const data = await response.json();
      const transcript = data.results?.channels[0]?.alternatives[0];

      if (!transcript?.transcript) {
        throw new TranscriptionError('No transcription available');
      }

      return {
        text: transcript.transcript,
        confidence: transcript.confidence
      };
    } catch (error) {
      if (error instanceof TranscriptionError) {
        throw error;
      }
      throw new TranscriptionError(
        'Transcription failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        error
      );
    }
  }
}