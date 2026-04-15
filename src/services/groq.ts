import Groq from 'groq-sdk';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PROMPT_LENGTH = 8000;

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ChatError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ChatError';
  }
}

const truncateMessage = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength - 3) + '...';
};

const prepareMessages = (
  personaPrompt: string,
  conversationHistory: Message[],
  userMessage: string
): Message[] => {
  const truncatedPrompt = truncateMessage(personaPrompt, MAX_PROMPT_LENGTH);
  
  const recentMessages = conversationHistory
    .slice(-MAX_MESSAGES)
    .map(msg => ({
      ...msg,
      content: truncateMessage(msg.content, MAX_MESSAGE_LENGTH)
    }));
  
  return [
    { role: 'system', content: truncatedPrompt },
    ...recentMessages,
    { role: 'user', content: truncateMessage(userMessage, MAX_MESSAGE_LENGTH) }
  ];
};

export const generateChatResponse = async (
  personaPrompt: string,
  conversationHistory: Message[],
  userMessage: string
): Promise<string> => {
  try {
    if (!GROQ_API_KEY) {
      throw new ChatError('Missing API key');
    }

    const groq = new Groq({
      apiKey: GROQ_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const messages = prepareMessages(personaPrompt, conversationHistory, userMessage);

    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2048,
      stream: false
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new ChatError('Invalid response format from API');
    }

    return response;
  } catch (error: any) {
    let userFriendlyMessage = 'Failed to generate response. ';
    
    if (error.details?.status === 413 || error.message?.includes('rate_limit_exceeded')) {
      userFriendlyMessage += 'Message too long. Please try a shorter message.';
    } else if (error.message?.includes('401')) {
      userFriendlyMessage += 'Invalid API key.';
    } else if (error.message?.includes('404')) {
      userFriendlyMessage += 'API endpoint not found.';
    } else if (error.message?.includes('429')) {
      userFriendlyMessage += 'Rate limit exceeded. Please try again later.';
    } else if (error.message?.includes('500')) {
      userFriendlyMessage += 'Server error. Please try again later.';
    } else {
      userFriendlyMessage += error.message || 'An unexpected error occurred';
    }

    throw new ChatError(userFriendlyMessage, error);
  }
};