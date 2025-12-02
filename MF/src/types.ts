import { Auth } from "firebase/auth";
import { Firestore, Timestamp } from "firebase/firestore";

// API & Gemini Types
export interface GeminiDetails {
  definition: string | null;
  partOfSpeech: string | null;
  transcription: string | null;
  examples: string[];
  error: string | null;
}

// Database & Word Types
export interface Word extends GeminiDetails {
  id: string;
  word: string;
  userContext: string;
  dateAdded: Timestamp | null;
  userId: string;
  isFetchingDetails: boolean;
}

// Component Props Types
export interface WordDetailProps {
  wordData: Word;
  db: Firestore;
  onBack: () => void;
}

export interface AddWordFormProps {
  db: Firestore | null;
  userId: string | null;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export interface WordItemProps {
  word: Word;
  onSelect: (id: string) => void;
  db: Firestore | null;
}

export interface WordListProps {
  words: Word[];
  onSelectWord: (id: string) => void;
  db: Firestore | null;
  userId: string | null;
}

export interface AuthFormProps {
  auth: Auth | null;
  onSuccess: (uid: string) => void;
}

export interface DetailCardProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export interface LoadingIndicatorProps {
  message?: string;
}
