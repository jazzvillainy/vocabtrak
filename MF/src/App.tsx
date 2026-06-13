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
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
    } catch {
      /* ignore */
    }
    return "dark";
  });
  const [userOverride, setUserOverride] = useState(false);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      const { db: firestore, auth: authInstance } = initializeFirebase();

      // Schedule state updates to avoid synchronous setState in the effect body
      const t = setTimeout(() => {
        setDb(firestore);
        setAuth(authInstance);
      }, 0);

      const unsubscribeAuth = onAuthStateChanged(
        authInstance,
        async (user: User | null) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(""); // User is not authenticated
          }
          setIsAuthReady(true);
        },
      );
      return () => {
        clearTimeout(t);
        unsubscribeAuth();
      };
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      // defer state update to avoid synchronous setState in effect
      setTimeout(() => setIsAuthReady(true), 0);
    }
  }, []);

  // 2. Firestore Real-time Listener (only runs if authenticated)
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;

    const wordsColRef = collection(
      db,
      `/artifacts/${firebaseConfig.projectId}/public/data/words`,
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
      },
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

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    type MQ = MediaQueryList & {
      addListener?: (l: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (l: (e: MediaQueryListEvent) => void) => void;
    };
    const mq: MQ = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (ev: MediaQueryListEvent) => {
      if (!userOverride) setTheme(ev.matches ? "dark" : "light");
    };
    // older browsers use addListener; prefer addEventListener when available
    (mq as unknown as EventTarget).addEventListener(
      "change",
      handleChange as EventListener,
    );
    return () => {
      (mq as unknown as EventTarget).removeEventListener(
        "change",
        handleChange as EventListener,
      );
    };
  }, [userOverride]);

  return (
    <div className={`min-h-screen font-sans app-root`}>
      {/* Header / Nav */}
      <header className="sticky top-0 z-10 app-header shadow-xl">
        <div className="max-w-4xl mx-auto px-md py-sm flex justify-between items-center gap-md">
          <h1 className="font-bold app-logo whitespace-nowrap">
            <span className="logo-hash">#</span>
            <span>Alphabet</span>
            <span className="logo-subtitle">— words, defined</span>
          </h1>
          <div className="flex items-center gap-md ml-auto">
            {userId && (
              <p className="text-xs text-muted hidden sm:block">
                <span className="font-mono">{userId?.slice(0, 8)}</span>
              </p>
            )}

            {userId && auth && (
              <button
                onClick={handleSignOut}
                className="btn-secondary px-md py-sm text-xs flex items-center hover:bg-error/10 hover:text-error"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline ml-sm">Sign Out</span>
              </button>
            )}
            <button
              onClick={() => {
                setUserOverride(true);
                setTheme(theme === "dark" ? "light" : "dark");
              }}
              className="p-sm rounded-full hover:bg-surface transition-colors"
              title="Toggle Theme"
              aria-label="Toggle dark/light theme"
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4 icon" />
              ) : (
                <Sun className="w-4 h-4 icon" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-lg px-md">{content}</main>
    </div>
  );
};

export default App;
