export interface Bot {
  id: string;
  name: string;
  description: string;
  avatar: string;
  status: 'active' | 'draft' | 'archived';
  systemInstruction: string;
  knowledgeBase: KnowledgeEntry[];
  usageCount: number;
  lastActive: string;
  // Model Parameters
  temperature: number;
  topP: number;
  topK: number;
  // Capabilities
  canPreviewCode: boolean;
  hasImageGen: boolean;
  hasAudioGen: boolean;
  hasVideoGen: boolean;
  hasSearchGrounding: boolean;
  hasLiveVoice: boolean;
  // Support & Info
  contactEmail?: string;
  website?: string;
  otherInfo?: string;
}

export interface KnowledgeEntry {
  id: string;
  content: string;
  source: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'audio' | 'video';
  mediaUrl?: string;
  fileName?: string;
  groundingChunks?: any[];
}