import { TwitterError } from '../types/errors';

interface Tweet {
  text: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  topics?: string[];
}

const cleanTweet = (text: string): string => {
  return text
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/RT\s+/g, '') // Remove RT
    .replace(/@\w+/g, '') // Remove mentions
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

const extractPersonality = (tweets: Tweet[]): string[] => {
  const traits = new Set<string>();
  
  tweets.forEach(tweet => {
    const text = tweet.text.toLowerCase();
    
    // Emotional traits
    if (text.includes('!') || text.includes('🚀') || text.includes('💡')) {
      traits.add('enthusiastic');
    }
    if (text.includes('❤️') || text.includes('grateful') || text.includes('thanks')) {
      traits.add('warm');
    }
    
    // Professional traits
    if (text.includes('tip') || text.includes('guide') || text.includes('how to')) {
      traits.add('helpful');
    }
    if (text.includes('learn') || text.includes('study') || text.includes('discover')) {
      traits.add('educational');
    }
    
    // Intellectual traits
    if (text.includes('think') || text.includes('opinion') || text.includes('perspective')) {
      traits.add('thoughtful');
    }
    if (text.includes('research') || text.includes('data') || text.includes('analysis')) {
      traits.add('analytical');
    }
    
    // Content style
    if (text.includes('new') || text.includes('just') || text.includes('latest')) {
      traits.add('up-to-date');
    }
    if (text.includes('we') || text.includes('let\'s') || text.includes('together')) {
      traits.add('collaborative');
    }
  });

  return Array.from(traits);
};

const extractTopics = (tweets: Tweet[]): string[] => {
  const topics = new Set<string>();
  
  const topicKeywords = {
    'AI/ML': ['ai', 'ml', 'machine learning', 'artificial intelligence', 'deep learning', 'neural'],
    'Web Development': ['web', 'frontend', 'backend', 'fullstack', 'javascript', 'react'],
    'Data Science': ['data', 'analytics', 'visualization', 'statistics', 'python', 'pandas'],
    'Cloud Computing': ['cloud', 'aws', 'azure', 'devops', 'kubernetes', 'docker'],
    'Cybersecurity': ['security', 'cyber', 'encryption', 'privacy', 'protection', 'hack'],
    'Mobile Development': ['mobile', 'ios', 'android', 'app', 'flutter', 'react native'],
    'Programming': ['coding', 'programming', 'software', 'development', 'engineering'],
    'Career Growth': ['career', 'job', 'interview', 'skills', 'learning', 'growth']
  };

  tweets.forEach(tweet => {
    const text = tweet.text.toLowerCase();
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        topics.add(topic);
      }
    });
  });

  return Array.from(topics);
};

export const analyzeTweets = (url: string): string => {
  const username = url.split('/').pop()?.replace('@', '') || '';
  
  if (!username) {
    throw new TwitterError('Invalid Twitter URL');
  }

  const tweets = fetchTweets(url);
  const personality = extractPersonality(tweets.map(text => ({ text })));
  const topics = extractTopics(tweets.map(text => ({ text })));

  return `I am a tech influencer and content creator specializing in ${topics.join(', ')}. My communication style reflects the following traits: ${personality.join(', ')}. I engage with my audience through informative yet approachable content, using emojis and practical examples to explain complex topics.

Key characteristics:
- Deep technical expertise in ${topics.slice(0, 3).join(', ')}
- ${personality.join('\n- ')}
- Clear and concise explanations
- Data-driven insights
- Professional yet relatable tone

Focus areas:
${topics.map(topic => `- ${topic}`).join('\n')}

I maintain an educational yet engaging tone, breaking down complex concepts into digestible pieces while keeping up with the latest industry trends.`;
};

export const fetchTweets = (url: string): string[] => {
  try {
    // Simulated tweets - in production, this would use Twitter's API
    const sampleTweets = [
      "Just deployed a new ML model that's 30% more efficient! 🚀 Here's how we optimized it using PyTorch and CUDA...",
      "Pro tip: When starting with AI, focus on understanding data preprocessing and feature engineering first! 📊 #MachineLearning",
      "Remember: The best code is maintainable code. Document well, use clear naming, and follow SOLID principles! 💡 #CodeQuality",
      "Excited to share my latest research on transformer architectures and their impact on NLP tasks! 🤖 #AI #DeepLearning",
      "Quick thread on scaling your ML infrastructure using Kubernetes and MLflow... 🛠️ #MLOps",
      "Just published a comprehensive guide on building resilient microservices with Docker and K8s! 📚 #DevOps",
      "Here's why data validation is crucial for your ML pipeline - lessons learned from production 📈 #DataScience",
      "The future of web development: My thoughts on Web Assembly and Edge Computing 🌐 #WebDev",
      "Security first! How to implement proper authentication in your web apps 🔒 #CyberSecurity",
      "Building scalable mobile apps? Here's why you should consider Flutter 📱 #MobileDev"
    ];

    return sampleTweets.map(cleanTweet);
  } catch (error) {
    console.error('Error fetching tweets:', error);
    throw new TwitterError(
      error instanceof Error ? error.message : 'Failed to fetch tweets',
      error
    );
  }
};