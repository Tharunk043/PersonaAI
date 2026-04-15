import React from 'react';
import { Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { VoiceOption, VOICE_OPTIONS } from '../types/voice';

interface VoiceSettingsProps {
  voiceMode: boolean;
  isPlaying: boolean;
  selectedVoice: string;
  onVoiceModeToggle: () => void;
  onPlayPauseToggle: () => void;
  onVoiceChange: (voice: string) => void;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  voiceMode,
  isPlaying,
  selectedVoice,
  onVoiceModeToggle,
  onPlayPauseToggle,
  onVoiceChange,
}) => {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onVoiceModeToggle}
        className={`p-2 rounded-lg transition-colors ${
          voiceMode 
            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        title={voiceMode ? 'Disable voice mode' : 'Enable voice mode'}
      >
        {voiceMode ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      {voiceMode && (
        <>
          <button
            onClick={onPlayPauseToggle}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <select
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
          >
            {VOICE_OPTIONS.map((voice: VoiceOption) => (
              <option key={voice.value} value={voice.value}>
                {voice.name} - {voice.accent}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
};

export default VoiceSettings;