export interface AudioTranscriptionResult {
  text: string;
  confidence?: number;
}

export class AudioError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'AudioError';
  }
}

export const transcribeAudio = async (audioBlob: Blob): Promise<AudioTranscriptionResult> => {
  try {
    // Validate blob
    if (!audioBlob || audioBlob.size === 0) {
      throw new AudioError('Invalid audio data');
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new AudioError('Missing API key');
    }

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
      body: formData
    });

    if (!response.ok) {
      throw new AudioError(`API error: ${response.status}`);
    }

    const data = await response.json();
    const transcript = data.results?.channels[0]?.alternatives[0];

    if (!transcript?.transcript) {
      throw new AudioError('No transcription available');
    }

    return {
      text: transcript.transcript,
      confidence: transcript.confidence
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw new AudioError(
      error instanceof AudioError ? error.message : 'Failed to transcribe audio',
      error
    );
  }
};

export const startRecording = async (): Promise<MediaRecorder> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 44100
      }
    });

    const options = {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
      audioBitsPerSecond: 128000
    };

    const recorder = new MediaRecorder(stream, options);
    return recorder;
  } catch (error) {
    console.error('Recording error:', error);
    throw new AudioError(
      error instanceof Error ? error.message : 'Could not access microphone',
      error
    );
  }
};

export const stopRecording = (recorder: MediaRecorder, stream: MediaStream): void => {
  try {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    stream.getTracks().forEach(track => {
      if (track.readyState === 'live') {
        track.stop();
      }
    });
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw new AudioError('Failed to stop recording', error);
  }
};