import React, { useState, useEffect, useMemo } from "react";
import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import { Moon, Sun, LogOut } from "lucide-react";

// Types
import { Word } from "./types";

// Configuration
import { firebaseConfig, initializeFirebase } from "./config/firebase";

// Utilities
// import { formatDate } from "./utils/dateUtils";

// Components
import { LoadingIndicator } from "./components/LoadingIndicator";
import { AuthForm } from "./components/AuthForm";
import { WordDetail } from "./components/WordDetail";
import { WordList } from "./components/WordList";

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
      const { db: firestore, auth: authInstance } = initializeFirebase();
      setDb(firestore);
      setAuth(authInstance);

      const unsubscribeAuth = onAuthStateChanged(
        authInstance,
        async (user: User | null) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(""); // User is not authenticated
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

    const wordsColRef = collection(
      db,
      `/artifacts/${firebaseConfig.projectId}/public/data/words`
    );
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
            dateAdded: data.dateAdded || null,
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
