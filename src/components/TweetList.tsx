import React from 'react';
import { Loader2 } from 'lucide-react';

interface TweetListProps {
  tweets: string[];
  isLoading: boolean;
  error: string | null;
}

const TweetList: React.FC<TweetListProps> = ({ tweets, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tweets.map((tweet, index) => (
        <div
          key={index}
          className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <span className="font-medium text-indigo-600 dark:text-indigo-400">
            {index + 1}.
          </span>{' '}
          <span className="text-gray-800 dark:text-gray-200">
            {tweet}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TweetList;