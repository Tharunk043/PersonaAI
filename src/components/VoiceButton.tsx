import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, StopCircle } from 'lucide-react';

interface VoiceButtonProps {
  onTranscription: (text: string) => void;
  onError: (error: string) => void;
  isDisabled?: boolean;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscription, onError, isDisabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const transcribeAudio = async (audioBlob: Blob) => {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('Deepgram API key is missing');
    }

    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const transcript = data.results?.channels[0]?.alternatives[0]?.transcript;

      if (!transcript) {
        throw new Error('No transcription received');
      }

      return transcript;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  };

  const handleStartRecording = useCallback(async () => {
    try {
      setIsProcessing(true);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        }
      });

      const options = {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
        audioBitsPerSecond: 128000
      };

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(chunksRef.current, { type: options.mimeType });
          
          if (audioBlob.size === 0) {
            throw new Error('No audio data recorded');
          }

          const transcript = await transcribeAudio(audioBlob);
          onTranscription(transcript);
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Failed to transcribe audio');
        } finally {
          setIsRecording(false);
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsProcessing(false);
    } catch (error) {
      setIsRecording(false);
      setIsProcessing(false);
      onError(error instanceof Error ? error.message : 'Failed to access microphone');
    }
  }, [onTranscription, onError]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return (
    <button
      type="button"
      onClick={isRecording ? handleStopRecording : handleStartRecording}
      disabled={isDisabled || isProcessing}
      className={`${
        isRecording 
          ? 'bg-gray-900 hover:bg-gray-800' 
          : 'bg-gray-700 hover:bg-gray-600'
      } text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
};

export default VoiceButton;