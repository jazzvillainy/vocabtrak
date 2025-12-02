import React, { useState, useEffect, useCallback, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  // signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,

} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  doc,
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  // DocumentData,
} from "firebase/firestore";
import {
  Loader2,
  Plus,
  Zap,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Trash2,
  BookOpen,
  Minus,
  LogIn,
  UserPlus,
  LogOut,
  Mail,
  Lock,
} from "lucide-react";

// --- Global Firebase & API Configuration ---
const firebaseConfig: object = {
  apiKey: "AIzaSyCNQaSaKvB8mYCgD7Um_oow6zUMVfpO-Rc",
  authDomain: "wordapp-ae5b5.firebaseapp.com",
  projectId: "wordapp-ae5b5",
  storageBucket: "wordapp-ae5b5.firebasestorage.app",
  messagingSenderId: "15749175952",
  appId: "1:15749175952:web:4a3f56eb942bf69883d615",
  measurementId: "G-JB0Q0KWNEE",
};

// const initialAuthToken: string | null =
  // typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;
// const appId: string =
  // typeof __app_id !== "undefined" ? __app_id : "default-word-app-id";
const GEMINI_MODEL: string = "gemini-2.5-flash-preview-09-2025";
const API_KEY: string = "AIzaSyCRPsN1f08AJf13kLVL6T8_quDREfK1g-c"; // Canvas will provide this if empty

// --- Type Definitions ---

interface GeminiDetails {
  definition: string | null;
  partOfSpeech: string | null;
  transcription: string | null;
  examples: string[];
  error: string | null;
}

interface Word extends GeminiDetails {
  id: string;
  word: string;
  userContext: string;
  dateAdded: Timestamp | null;
  userId: string;
  isFetchingDetails: boolean;
}

interface WordDetailProps {
  wordData: Word;
  db: Firestore;
  onBack: () => void;
}

interface AddWordFormProps {
  db: Firestore | null;
  userId: string | null;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

interface WordItemProps {
  word: Word;
  onSelect: (id: string) => void;
  db: Firestore | null;
}

interface WordListProps {
  words: Word[];
  onSelectWord: (id: string) => void;
  db: Firestore | null;
  userId: string | null;
}

interface AuthFormProps {
  auth: Auth | null;
  onSuccess: (uid: string) => void;
}

// --- Utility Functions ---

const formatDate = (timestamp: Timestamp | null): string => {
  if (!timestamp) return "N/A";
  try {
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp as any).toLocaleDateString();
  } catch {
    return "Invalid Date";
  }
};

const fetchWordDetailsFromGemini = async (
  word: string,
  userContext: string
): Promise<GeminiDetails> => {
  const systemPrompt = `You are a word definition and language analysis expert. Based on the user's word and context, find its definition, part of speech, phonetic transcription, and provide 2 clear example sentences. Respond ONLY with a JSON object that adheres strictly to the provided schema.`;
  const userQuery = `Word: "${word}". Context: "${userContext}". Please provide the definition, part of speech, phonetic transcription, and 2 example sentences.`;

  const definitionSchema = {
    type: "OBJECT",
    properties: {
      definition: {
        type: "STRING",
        description: "The primary meaning of the word.",
      },
      partOfSpeech: {
        type: "STRING",
        description:
          "The grammatical part of speech (e.g., noun, verb, adjective).",
      },
      transcription: {
        type: "STRING",
        description:
          "The phonetic transcription or pronunciation guide (e.g., /ˌsɪl.əˈɡɪ.zəm/).",
      },
      examples: {
        type: "ARRAY",
        description: "An array of 2-3 clear example sentences using the word.",
        items: { type: "STRING" },
      },
    },
    propertyOrdering: [
      "definition",
      "partOfSpeech",
      "transcription",
      "examples",
    ],
  };

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    tools: [{ google_search: {} }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: definitionSchema,
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API response status: ${response.status}`);
      }

      const result = await response.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (jsonText) {
        try {
          const parsedJson = JSON.parse(jsonText);
          return {
            definition: parsedJson.definition || null,
            partOfSpeech: parsedJson.partOfSpeech || null,
            transcription: parsedJson.transcription || null,
            examples: Array.isArray(parsedJson.examples)
              ? parsedJson.examples
              : [],
            error: null,
          };
        } catch (e) {
          console.error("Failed to parse JSON response:", jsonText, e);
        }
      }
      throw new Error(
        "API response structure missing content or invalid JSON."
      );
    } catch (error: any) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
      } else {
        return {
          definition: "Could not fetch definition details.",
          partOfSpeech: null,
          transcription: null,
          examples: [],
          error: `Failed to fetch details after multiple retries. ${error.message}`,
        };
      }
    }
  }
  return {
    definition: null,
    partOfSpeech: null,
    transcription: null,
    examples: [],
    error: "Unknown fetch failure.",
  };
};

// --- UI Components ---

const LoadingIndicator: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => (
  <div className="flex justify-center items-center p-6 text-slate-400">
    <Loader2 className="w-5 h-5 animate-spin mr-3 text-sky-400" />
    {message}
  </div>
);

const DetailCard: React.FC<{
  title: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, children, className = "" }) => (
  <div
    className={`p-4 bg-slate-800 rounded-xl shadow-lg border border-slate-700 ${className}`}
  >
    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
      {title}
    </h3>
    <div className="text-slate-200">{children}</div>
  </div>
);

// --- New: Authentication Form Component ---

const AuthForm: React.FC<AuthFormProps> = ({ auth, onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) return;

    setError("");
    setIsLoading(true);

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      onSuccess(userCredential.user.uid);
      console.log(
        isLogin
          ? "User signed in successfully."
          : "User registered successfully."
      );
    } catch (err: any) {
      console.error("Authentication Error:", err);
      // Handle Firebase error codes for user-friendly messages
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Try signing in.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email format.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid email or password.");
      } else {
        setError(`Authentication failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 mt-16">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">
        {isLogin ? "Sign In" : "Create Account"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative">
          <Mail className="w-5 h-5 absolute top-3 left-3 text-slate-400" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>
        <div className="relative">
          <Lock className="w-5 h-5 absolute top-3 left-3 text-slate-400" />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {error && (
          <div className="text-red-400 bg-red-900/30 p-3 rounded-lg text-sm border border-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-md text-lg font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:opacity-70 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : isLogin ? (
            <>
              <LogIn className="w-5 h-5 mr-2" /> Sign In
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5 mr-2" /> Sign Up
            </>
          )}
        </button>
      </form>

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="w-full mt-4 text-center text-sm text-slate-400 hover:text-sky-400 transition-colors"
      >
        {isLogin
          ? "Need an account? Sign Up"
          : "Already have an account? Sign In"}
      </button>
    </div>
  );
};

// --- Word List and Detail Components (omitted for brevity, they are the same) ---

const WordDetail: React.FC<WordDetailProps> = ({ wordData, db, onBack }) => {
  // ... (WordDetail logic is unchanged)
  // [WordDetail component code remains the same as previous file]
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const ensureDetailsFetched = useCallback(async () => {
    if (
      !db ||
      !wordData.id ||
      wordData.definition ||
      wordData.isFetchingDetails ||
      isFetching
    )
      return;

    setIsFetching(true);
    setError(null);

    const docRef = doc(
      db,
      `/artifacts/${appId}/public/data/words`,
      wordData.id
    );

    try {
      await updateDoc(docRef, { isFetchingDetails: true });
    } catch (e) {
      console.error("Failed to mark as fetching in Firestore:", e);
    }

    const details = await fetchWordDetailsFromGemini(
      wordData.word,
      wordData.userContext
    );

    const updatePayload: DocumentData = {
      isFetchingDetails: false,
      definition: details.definition,
      partOfSpeech: details.partOfSpeech,
      transcription: details.transcription,
      examples: details.examples,
    };

    if (details.error) {
      setError(details.error);
      updatePayload.error = details.error;
    }

    try {
      await updateDoc(docRef, updatePayload);
    } catch (e) {
      console.error("Failed to update word document with details:", e);
      setError((prev) => prev || "Failed to save details to the database.");
    } finally {
      setIsFetching(false);
    }
  }, [
    db,
    wordData.id,
    wordData.definition,
    isFetching,
    wordData.word,
    wordData.userContext,
    wordData.isFetchingDetails,
  ]);

  useEffect(() => {
    if (
      wordData &&
      !wordData.definition &&
      !wordData.isFetchingDetails &&
      !isFetching
    ) {
      ensureDetailsFetched();
    }
  }, [wordData, ensureDetailsFetched, isFetching]);

  const displayData = wordData;
  const isLoading = isFetching || displayData.isFetchingDetails;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <button
        onClick={onBack}
        className="flex items-center text-sky-400 hover:text-sky-300 transition-colors font-medium mb-4"
      >
        <ChevronUp className="w-5 h-5 rotate-90 mr-2" />
        Back to Word List
      </button>

      <header className="border-b border-slate-700 pb-4">
        <h1 className="text-4xl font-extrabold text-white">
          {displayData.word}
        </h1>
        <p className="text-slate-400 mt-1 flex items-center">
          <BookOpen className="w-4 h-4 mr-1" />
          Added: {formatDate(displayData.dateAdded)}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          <span className="font-semibold text-slate-400">User ID: </span>
          {displayData.userId}
        </p>
      </header>

      {(error || displayData.error) && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg">
          <p className="font-semibold">Error Fetching Details:</p>
          <p className="text-sm">{error || displayData.error}</p>
        </div>
      )}

      {isLoading && !(error || displayData.error) ? (
        <LoadingIndicator
          message={`Fetching definition and examples for "${displayData.word}"...`}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <DetailCard title="Definition">
            <p className="text-lg">
              {displayData.definition ||
                "Definition not yet fetched or available."}
            </p>
          </DetailCard>

          <DetailCard title="Original Context">
            <p className="italic text-lg text-slate-300">
              "{displayData.userContext || "No context provided."}"
            </p>
          </DetailCard>

          <DetailCard
            title="Grammatical Details"
            className="col-span-1 md:col-span-2"
          >
            <div className="flex flex-wrap gap-4">
              <span className="bg-sky-700/50 text-sky-300 px-3 py-1 rounded-full text-sm font-mono border border-sky-600">
                Part of Speech:{" "}
                <span className="font-bold">
                  {displayData.partOfSpeech || "N/A"}
                </span>
              </span>
              <span className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-sm font-mono border border-slate-600">
                Transcription:{" "}
                <span className="font-bold">
                  {displayData.transcription || "N/A"}
                </span>
              </span>
            </div>
          </DetailCard>

          <DetailCard title="Examples" className="col-span-1 md:col-span-2">
            {displayData.examples && displayData.examples.length > 0 ? (
              <ul className="list-disc list-inside space-y-2">
                {displayData.examples.map((ex, index) => (
                  <li key={index} className="text-slate-300">
                    {ex}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">
                No examples found or provided by the API.
              </p>
            )}
          </DetailCard>
        </div>
      )}
    </div>
  );
};

const AddWordForm: React.FC<AddWordFormProps> = ({
  db,
  userId,
  isCollapsed,
  toggleCollapse,
}) => {
  // ... (AddWordForm logic is unchanged)
  // [AddWordForm component code remains the same as previous file]
  const [word, setWord] = useState<string>("");
  const [context, setContext] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!db || !userId || isSubmitting || !word.trim()) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      await addDoc(collection(db, `/artifacts/${appId}/public/data/words`), {
        word: word.trim(),
        userContext: context.trim() || "No context specified",
        dateAdded: Timestamp.now(),
        userId: userId,
        definition: null,
        partOfSpeech: null,
        transcription: null,
        examples: [],
        isFetchingDetails: false,
      });
      setMessage(`"${word.trim()}" added successfully!`);
      setWord("");
      setContext("");
      toggleCollapse();
    } catch (error) {
      console.error("Error adding document: ", error);
      setMessage("Failed to add word. Check console for details.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-inner">
      <button
        onClick={toggleCollapse}
        className="w-full text-left p-4 flex items-center justify-between transition-colors hover:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <h2 className="text-2xl font-bold text-white flex items-center">
          {isCollapsed ? (
            <Plus className="w-5 h-5 mr-2 text-sky-400" />
          ) : (
            <Minus className="w-5 h-5 mr-2 text-sky-400" />
          )}
          Add New Word of the Day
        </h2>
        <span className="text-slate-400">
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronUp className="w-5 h-5" />
          )}
        </span>
      </button>

      <div
        className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${
          isCollapsed ? "max-h-0" : "max-h-[500px]"
        }`}
      >
        <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="word"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Word
              </label>
              <input
                id="word"
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                required
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-sky-500 focus:border-sky-500"
                placeholder="e.g., Ephemeral"
              />
            </div>
            <div>
              <label
                htmlFor="context"
                className="block text-sm font-medium text-slate-300 mb-1"
              >
                Context Heard/Used In
              </label>
              <input
                id="context"
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-sky-500 focus:border-sky-500"
                placeholder="e.g., Read in an old philosophy book"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !word.trim()}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:opacity-70 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Zap className="w-5 h-5 mr-2" />
            )}
            {isSubmitting ? "Adding..." : "Add Word"}
          </button>

          {message && (
            <p className="text-sm text-center text-green-400 mt-2">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
};

const WordItem: React.FC<WordItemProps> = ({ word, onSelect, db }) => {
  // ... (WordItem logic is unchanged)
  // [WordItem component code remains the same as previous file]
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const docPath = `/artifacts/${appId}/public/data/words`;

  const toggleExpand = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    wordId: string
  ) => {
    e.stopPropagation();
    if (!db) return;

    console.log(`Simulating confirmation for deletion of word ID: ${wordId}`);
    try {
      const docRef = doc(db, docPath, wordId);
      await deleteDoc(docRef);
      console.log("Document successfully deleted!");
    } catch (error) {
      console.error("Error removing document: ", error);
    }
  };

  const hasDetails = !!word.definition;
  const isFetching = word.isFetchingDetails;

  return (
    <div className="flex flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-md transition-shadow hover:shadow-lg">
      <div
        className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors rounded-t-xl flex justify-between items-center"
        onClick={() => onSelect(word.id)}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-white truncate">
            {word.word}
            {word.partOfSpeech && (
              <span className="text-sm font-normal ml-2 text-slate-400">
                ({word.partOfSpeech})
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Added: {formatDate(word.dateAdded)}
          </p>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          {isFetching ? (
            <span className="text-sky-400 flex items-center text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...
            </span>
          ) : (
            <button
              onClick={toggleExpand}
              className="p-1 text-slate-400 hover:text-white rounded-full transition-colors"
              aria-label={
                isExpanded ? "Collapse details" : "Expand definition summary"
              }
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            onClick={(e) => handleDelete(e, word.id)}
            className="p-1 text-red-400 hover:text-red-300 rounded-full transition-colors"
            title="Delete Word"
            aria-label="Delete word"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out border-t border-slate-700/50 
                           ${
                             isExpanded
                               ? "max-h-96 opacity-100"
                               : "max-h-0 opacity-0 border-t-0"
                           }`}
      >
        <div className="p-4 pt-3">
          <p className="text-slate-300 text-base">
            {word.definition && hasDetails ? (
              word.definition
            ) : isFetching ? (
              <span className="text-sky-400 italic">
                Definition is being generated by AI...
              </span>
            ) : (
              <span className="text-slate-500 italic">
                No definition available. Click to view details and generate!
              </span>
            )}
          </p>
          <button
            onClick={() => onSelect(word.id)}
            className="mt-2 text-sky-400 hover:text-sky-300 text-sm font-medium"
          >
            View Full Details →
          </button>
        </div>
      </div>
    </div>
  );
};

const WordList: React.FC<WordListProps> = ({
  words,
  onSelectWord,
  db,
  userId,
}) => {
  // ... (WordList logic is unchanged)
  // [WordList component code remains the same as previous file]
  const [isFormCollapsed, setIsFormCollapsed] = useState<boolean>(true);

  const toggleCollapse = () => {
    setIsFormCollapsed((prev) => !prev);
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <AddWordForm
        db={db}
        userId={userId}
        isCollapsed={isFormCollapsed}
        toggleCollapse={toggleCollapse}
      />

      <h2 className="text-3xl font-bold text-white border-b border-slate-700 pb-3">
        Your Vocabulary List ({words.length})
      </h2>

      {words.length === 0 ? (
        <div className="text-center p-12 bg-slate-800 rounded-xl text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-sky-500" />
          <p className="text-lg">Your word list is empty!</p>
          <p className="text-sm mt-1">
            Click "Add New Word of the Day" above to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {words.map((word) => (
            <WordItem
              key={word.id}
              word={word}
              onSelect={onSelectWord}
              db={db}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Application Component ---

const App: React.FC = () => {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  const [words, setWords] = useState<Word[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const app: FirebaseApp = initializeApp(firebaseConfig);
      const firestore: Firestore = getFirestore(app);
      const authInstance: Auth = getAuth(app);
      setDb(firestore);
      setAuth(authInstance);

      const unsubscribeAuth = onAuthStateChanged(
        authInstance,
        async (user: User | null) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null); // User is not authenticated
            // In the Canvas environment, try the custom token for automatic login
            if (initialAuthToken) {
              try {
                await signInWithCustomToken(authInstance, initialAuthToken);
              } catch (e) {
                console.error(
                  "Custom token sign-in failed. User must log in.",
                  e
                );
                setUserId(null);
              }
            }
          }
          setIsAuthReady(true);
        }
      );

      return () => unsubscribeAuth();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setIsAuthReady(true);
    }
  }, []);

  // 2. Firestore Real-time Listener (only runs if authenticated)
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    const wordsColRef = collection(db, `/artifacts/${appId}/public/data/words`);
    const wordsQuery = query(wordsColRef);

    const unsubscribe = onSnapshot(
      wordsQuery,
      (snapshot) => {
        const wordsList: Word[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            word: (data.word as string) || "N/A",
            userContext: (data.userContext as string) || "N/A",
            dateAdded: (data.dateAdded as Timestamp) || null,
            userId: (data.userId as string) || "N/A",
            definition: (data.definition as string) || null,
            partOfSpeech: (data.partOfSpeech as string) || null,
            transcription: (data.transcription as string) || null,
            examples: Array.isArray(data.examples)
              ? (data.examples as string[])
              : [],
            isFetchingDetails: (data.isFetchingDetails as boolean) || false,
            error: (data.error as string) || null,
          };
        });

        wordsList.sort((a, b) => {
          const dateA = a.dateAdded?.seconds || 0;
          const dateB = b.dateAdded?.seconds || 0;
          return dateB - dateA;
        });
        setWords(wordsList);
      },
      (error) => {
        console.error("Firestore Listener Error:", error);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady, db, userId]);

  const handleSelectWord = (id: string) => {
    setSelectedWordId(id);
  };

  const handleBack = () => {
    setSelectedWordId(null);
  };

  const handleSignOut = async () => {
    if (auth) {
      await auth.signOut();
      setUserId(null);
      setSelectedWordId(null);
      setWords([]);
    }
  };

  const handleAuthSuccess = (uid: string) => {
    setUserId(uid);
  };

  const selectedWordData = useMemo(() => {
    return words.find((w) => w.id === selectedWordId) || null;
  }, [words, selectedWordId]);

  const isAppLoading = !isAuthReady || !db;

  let content;
  if (isAppLoading) {
    content = <LoadingIndicator message="Connecting to services..." />;
  } else if (!userId || !auth) {
    // Show Auth form if user is not logged in
    content = <AuthForm auth={auth} onSuccess={handleAuthSuccess} />;
  } else if (selectedWordId && selectedWordData) {
    // Show Word Details
    content = (
      <WordDetail wordData={selectedWordData} db={db!} onBack={handleBack} />
    );
  } else {
    // Show Word List
    content = (
      <WordList
        words={words}
        onSelectWord={handleSelectWord}
        db={db}
        userId={userId}
      />
    );
  }

  return (
    <div
      className={`min-h-screen font-sans ${
        theme === "dark" ? "bg-slate-900" : "bg-gray-100"
      } text-gray-100`}
    >
      {/* Header / Nav */}
      <header className="sticky top-0 z-10 bg-slate-950 border-b border-slate-700 shadow-xl">
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-black text-sky-400">
            <span className="hidden sm:inline">Vocabulary Tracker</span>
            <span className="sm:hidden">Vocab Tracker</span>
          </h1>
          <div className="flex items-center space-x-4">
            {userId && (
              <p className="text-sm text-slate-500 hidden sm:block">
                ID: <span className="font-mono text-slate-400">{userId}</span>
              </p>
            )}

            {userId && auth && (
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-red-400 hover:text-red-300 transition-colors border border-slate-700 bg-slate-800 flex items-center text-sm"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden md:inline ml-2">Sign Out</span>
              </button>
            )}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700 bg-slate-800"
              title="Toggle Theme"
              aria-label="Toggle dark/light theme"
            >
              {theme === "dark" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-8">{content}</main>
    </div>
  );
};

export default App;
