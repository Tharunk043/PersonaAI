import { API_BASE_URL } from '../config';

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

const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PROMPT_LENGTH = 8000;

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
    const messages = prepareMessages(personaPrompt, conversationHistory, userMessage);

    // Call our backend proxy instead of using the Groq SDK directly in the browser
    const res = await fetch(`${API_BASE_URL}/api2/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new ChatError(data.error || 'Failed to generate response from server');
    }

    const response = data.answer;
    if (!response) {
      throw new ChatError('Invalid response format from API');
    }

    return response;
  } catch (error: any) {
    if (error instanceof ChatError) throw error;
    
    let userFriendlyMessage = 'Failed to generate response. ';
    userFriendlyMessage += error.message || 'An unexpected error occurred';
    throw new ChatError(userFriendlyMessage, error);
  }
};