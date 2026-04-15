import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, ArrowLeft, AlertCircle, Upload, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FileData {
  name: string;
  content: string;
  type: string;
}

const RawInput: React.FC = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawData.trim() && files.length === 0) {
      setError('Please enter some content or upload files');
      return;
    }

    const allContent = [rawData, ...files.map(f => f.content)].filter(Boolean).join('\n\n');
    const personaPrompt = `Embody the following persona completely. Never break character or explain who you are unless explicitly asked. Keep responses brief and concise (2-3 sentences max). Never introduce yourself or explain that you're an AI.\n\n${allContent}\n\nStay in character at all times. Only reveal your identity if directly asked.`;
    
    navigate('/chat', { state: { personaPrompt } });
  };

  const processFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles?.length) return;

    setIsProcessing(true);
    setError(null);

    try {
      const newFiles = await Promise.all(
        Array.from(uploadedFiles).map(async (file) => {
          const content = await processFile(file);
          return {
            name: file.name,
            content,
            type: file.type || 'text/plain'
          };
        })
      );

      setFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      setError('Failed to process files. Only text files are supported.');
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(files.filter(f => f.name !== fileName));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <button
          onClick={() => navigate('/manual-input')}
          className="flex items-center gap-2 text-gray-900 dark:text-gray-100 mb-6 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Input Selection
        </button>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-8 py-6 bg-gray-900 dark:bg-black">
            <h2 className="text-2xl font-bold text-white">Raw Data Input</h2>
            <p className="mt-2 text-gray-300">Enter your persona data in free-form text or upload files</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p className="font-semibold mb-1">Include in your description:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Name and background</li>
                  <li>Personality traits and speaking style</li>
                  <li>Typical phrases and expressions</li>
                  <li>Knowledge areas and interests</li>
                </ul>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload Files (Text files only)
              </label>
              
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
                <div className="space-y-2 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-gray-900 dark:text-gray-300 hover:text-gray-600 focus-within:outline-none">
                      <span>Upload files</span>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept=".txt,.csv,.json,.md,text/*"
                        className="sr-only"
                        onChange={handleFileUpload}
                        disabled={isProcessing}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">TXT, CSV, or other text files</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.name)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="rawData" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Description
              </label>
              <textarea
                id="rawData"
                value={rawData}
                onChange={(e) => setRawData(e.target.value)}
                rows={15}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-transparent font-mono"
                placeholder="Enter additional persona description here..."
              />
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              Create Persona & Start Chat
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default RawInput;