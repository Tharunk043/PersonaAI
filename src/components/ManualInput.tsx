import React from 'react';
import { motion } from 'framer-motion';
import { Save, ArrowLeft, FileText, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManualInput: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-6 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-indigo-500 to-purple-600">
            <h2 className="text-2xl font-bold text-white">Choose Input Method</h2>
            <p className="mt-2 text-indigo-100">Select how you want to create your AI persona</p>
          </div>

          <div className="p-8 space-y-4">
            <button
              onClick={() => navigate('/structured-input')}
              className="w-full flex items-center justify-between p-6 bg-white dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 group transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-indigo-100 dark:bg-gray-600 group-hover:bg-indigo-200 dark:group-hover:bg-gray-500 transition-colors">
                  <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-500 dark:group-hover:text-indigo-400">
                    Structured Input
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Create your persona using a guided form with specific fields
                  </p>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 rotate-180 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
            </button>

            <button
              onClick={() => navigate('/raw-input')}
              className="w-full flex items-center justify-between p-6 bg-white dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 group transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-gray-600 group-hover:bg-purple-200 dark:group-hover:bg-gray-500 transition-colors">
                  <Code className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-purple-500 dark:group-hover:text-purple-400">
                    Raw Input
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Directly input raw text data to define your persona
                  </p>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 rotate-180 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ManualInput;