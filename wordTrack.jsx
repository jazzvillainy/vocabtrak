import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, query, onSnapshot, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Loader2, Plus, Zap, ChevronDown, ChevronUp, Moon, Sun, Trash2, BookOpen } from 'lucide-react';

// --- Global Firebase & API Configuration ---
// These global variables are provided by the canvas environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-word-app-id';
const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025';
const API_KEY = ""; // Canvas will provide this if empty

// --- Utility Functions ---

/** Converts the Firestore Timestamp to a readable date string. */
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Ensure it's a Firestore Timestamp object if it came from a document
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString();
    }
    // Fallback for non-Timestamp objects if the structure is unexpected
    return new Date(timestamp).toLocaleDateString();
};

/**
 * Fetches definition and details for a word using the Gemini API (with structured JSON output and grounding).
 */
const fetchWordDetailsFromGemini = async (word, userContext) => {
    const systemPrompt = `You are a word definition and language analysis expert. Based on the user's word and context, find its definition, part of speech, phonetic transcription, and provide 2 clear example sentences. Respond ONLY with a JSON object that adheres strictly to the provided schema.`;
    const userQuery = `Word: "${word}". Context: "${userContext}". Please provide the definition, part of speech, phonetic transcription, and 2 example sentences.`;

    // Structured output schema
    const definitionSchema = {
        type: "OBJECT",
        properties: {
            definition: { "type": "STRING", "description": "The primary meaning of the word." },
            partOfSpeech: { "type": "STRING", "description": "The grammatical part of speech (e.g., noun, verb, adjective)." },
            transcription: { "type": "STRING", "description": "The phonetic transcription or pronunciation guide (e.g., /ˌsɪl.əˈɡɪ.zəm/)." },
            examples: {
                "type": "ARRAY",
                "description": "An array of 2-3 clear example sentences using the word.",
                "items": { "type": "STRING" }
            }
        },
        propertyOrdering: ["definition", "partOfSpeech", "transcription", "examples"]
    };

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }], // Use Google Search for grounding
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: definitionSchema
        },
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;
    
    // Simple retry loop with exponential backoff (max 3 retries)
    for (let i = 0; i < 3; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Throw error to trigger retry or final catch
                throw new Error(`API response status: ${response.status}`);
            }

            const result = await response.json();
            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (jsonText) {
                try {
                    const parsedJson = JSON.parse(jsonText);
                    return {
                        definition: parsedJson.definition || 'No definition found.',
                        partOfSpeech: parsedJson.partOfSpeech || 'Unknown',
                        transcription: parsedJson.transcription || 'N/A',
                        examples: parsedJson.examples || [],
                        error: null,
                    };
                } catch (e) {
                    console.error("Failed to parse JSON response:", jsonText, e);
                    // Continue to next retry or return failure if this is the last one
                }
            }
            throw new Error("API response structure missing content.");
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000)); // Exponential backoff
            } else {
                return {
                    definition: 'Could not fetch definition details.',
                    partOfSpeech: 'Error',
                    transcription: 'Error',
                    examples: [],
                    error: `Failed to fetch details after multiple retries. ${error.message}`,
                };
            }
        }
    }
};


// --- UI Components ---

const LoadingIndicator = ({ message = "Loading..." }) => (
    <div className="flex justify-center items-center p-6 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-3 text-sky-400" />
        {message}
    </div>
);

const DetailCard = ({ title, children, className = "" }) => (
    <div className={`p-4 bg-slate-800 rounded-xl shadow-lg border border-slate-700 ${className}`}>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">{title}</h3>
        <div className="text-slate-200">{children}</div>
    </div>
);

const WordDetail = ({ wordData, db, onBack }) => {
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState(null);

    // Function to fetch and update details
    const ensureDetailsFetched = useCallback(async () => {
        if (!db || !wordData.id || wordData.definition || isFetching) return;

        setIsFetching(true);
        setError(null);
        console.log(`Fetching details for word: ${wordData.word}`);
        
        // Temporarily mark as fetching in Firestore
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/words`, wordData.id), {
            isFetchingDetails: true
        });

        const details = await fetchWordDetailsFromGemini(wordData.word, wordData.userContext);

        // Update Firestore with fetched details
        const updatePayload = {
            isFetchingDetails: false,
            ...details,
        };

        if (details.error) {
            setError(details.error);
            console.error("Gemini Fetch Error:", details.error);
            updatePayload.error = details.error; // Save error to document
        }

        try {
            await updateDoc(doc(db, `/artifacts/${appId}/public/data/words`, wordData.id), updatePayload);
        } catch (e) {
            console.error("Failed to update word document:", e);
            setError("Failed to save details to the database.");
        } finally {
            setIsFetching(false);
        }
    }, [db, wordData.id, wordData.definition, isFetching, wordData.word, wordData.userContext]);

    useEffect(() => {
        // Trigger fetch if details are missing and not currently being fetched
        if (wordData && !wordData.definition && !wordData.isFetchingDetails) {
            ensureDetailsFetched();
        }
    }, [wordData, ensureDetailsFetched]);

    const displayData = wordData || {};
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
                <h1 className="text-4xl font-extrabold text-white">{displayData.word}</h1>
                <p className="text-slate-400 mt-1 flex items-center">
                    <BookOpen className="w-4 h-4 mr-1" />
                    Added: {formatDate(displayData.dateAdded)}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-slate-400">User ID: </span>
                    {displayData.userId}
                </p>
            </header>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg">
                    <p className="font-semibold">Error Fetching Details:</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}
            
            {isLoading && !error ? (
                <LoadingIndicator message={`Fetching definition and examples for "${displayData.word}"...`} />
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    <DetailCard title="Definition">
                        <p className="text-lg">{displayData.definition || 'Definition not yet fetched or available.'}</p>
                    </DetailCard>

                    <DetailCard title="Original Context">
                        <p className="italic text-lg text-slate-300">"{displayData.userContext || 'No context provided.'}"</p>
                    </DetailCard>

                    <DetailCard title="Grammatical Details" className="col-span-1 md:col-span-2">
                        <div className="flex flex-wrap gap-4">
                            <span className="bg-sky-700/50 text-sky-300 px-3 py-1 rounded-full text-sm font-mono border border-sky-600">
                                Part of Speech: <span className="font-bold">{displayData.partOfSpeech || 'N/A'}</span>
                            </span>
                            <span className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-sm font-mono border border-slate-600">
                                Transcription: <span className="font-bold">{displayData.transcription || 'N/A'}</span>
                            </span>
                        </div>
                    </DetailCard>

                    <DetailCard title="Examples" className="col-span-1 md:col-span-2">
                        {displayData.examples && displayData.examples.length > 0 ? (
                            <ul className="list-disc list-inside space-y-2">
                                {displayData.examples.map((ex, index) => (
                                    <li key={index} className="text-slate-300">{ex}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-slate-400">No examples found or provided by the API.</p>
                        )}
                    </DetailCard>
                </div>
            )}
        </div>
    );
};


const AddWordForm = ({ db, userId }) => {
    const [word, setWord] = useState('');
    const [context, setContext] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId || isSubmitting || !word.trim()) return;

        setIsSubmitting(true);
        setMessage('');

        try {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/words`), {
                word: word.trim(),
                userContext: context.trim() || 'No context specified',
                dateAdded: Timestamp.now(),
                userId: userId,
                // Initial state for Gemini-fetched data
                definition: null,
                partOfSpeech: null,
                transcription: null,
                examples: [],
                isFetchingDetails: false, // Flag to prevent multiple fetches
            });
            setMessage(`"${word.trim()}" added successfully!`);
            setWord('');
            setContext('');
        } catch (error) {
            console.error("Error adding document: ", error);
            setMessage('Failed to add word. Check console for details.');
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-900 border border-slate-700 rounded-xl shadow-inner space-y-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
                <Plus className="w-5 h-5 mr-2 text-sky-400" />
                Add New Word of the Day
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="word" className="block text-sm font-medium text-slate-300 mb-1">Word</label>
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
                    <label htmlFor="context" className="block text-sm font-medium text-slate-300 mb-1">Context Heard/Used In</label>
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
                {isSubmitting ? 'Adding...' : 'Add Word'}
            </button>

            {message && (
                <p className="text-sm text-center text-green-400 mt-2">{message}</p>
            )}
        </form>
    );
};

const WordItem = ({ word, onSelect, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasDetails = !!word.definition;
    const isFetching = word.isFetchingDetails;

    const toggleExpand = (e) => {
        // Prevent click from propagating to the detail page link
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

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
                            <span className="text-sm font-normal ml-2 text-slate-400">({word.partOfSpeech})</span>
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
                        >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(word.id); }}
                        className="p-1 text-red-400 hover:text-red-300 rounded-full transition-colors"
                        title="Delete Word"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <div className="p-4 pt-0 border-t border-slate-700/50">
                    <p className="text-slate-300 text-base">
                        {word.definition && hasDetails ? 
                            word.definition 
                            : isFetching ? (
                                <span className="text-sky-400 italic">Definition is being generated by AI...</span>
                            ) : (
                                <span className="text-slate-500 italic">No definition available. Click to view details and generate!</span>
                            )
                        }
                    </p>
                    <button 
                        onClick={() => onSelect(word.id)}
                        className="mt-2 text-sky-400 hover:text-sky-300 text-sm font-medium"
                    >
                        View Full Details →
                    </button>
                </div>
            )}
        </div>
    );
};

const WordList = ({ words, onSelectWord, db, userId }) => {
    const handleDelete = async (wordId) => {
        if (!db || !wordId) return;

        // Use a custom modal in a real app, but for this demo, just console log a message
        // In a real application, you'd use a custom modal for confirmation.
        if (window.confirm("Are you sure you want to delete this word?")) {
             try {
                await updateDoc(doc(db, `/artifacts/${appId}/public/data/words`, wordId), {
                    // Soft delete: setting word to null or similar. 
                    // For simplicity, we use the standard deleteDoc here, but for collaborative apps, soft delete is often better.
                });
                // Since this is a collaborative/public collection, we can just use deleteDoc
                // In a true multi-user app, you might only allow the original creator to delete or require a custom security rule.
                const docRef = doc(db, `/artifacts/${appId}/public/data/words`, wordId);
                await deleteDoc(docRef);
                console.log("Document successfully deleted!");
            } catch (e) {
                console.error("Error removing document: ", e);
            }
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            <AddWordForm db={db} userId={userId} />

            <h2 className="text-3xl font-bold text-white border-b border-slate-700 pb-3">
                Your Vocabulary List ({words.length})
            </h2>

            {words.length === 0 ? (
                <div className="text-center p-12 bg-slate-800 rounded-xl text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-sky-500" />
                    <p className="text-lg">Your word list is empty!</p>
                    <p className="text-sm mt-1">Add a new word above to get started.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {words.map((word) => (
                        <WordItem 
                            key={word.id} 
                            word={word} 
                            onSelect={onSelectWord} 
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Main Application Component ---

export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    const [words, setWords] = useState([]);
    const [selectedWordId, setSelectedWordId] = useState(null);
    const [theme, setTheme] = useState('dark'); // Only dark theme is implemented as per request

    // 1. Firebase Initialization and Authentication
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestore);
            setAuth(authInstance);

            const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                } else {
                    // Try to sign in with custom token or anonymously
                    if (initialAuthToken) {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } else {
                        const anonUser = await signInAnonymously(authInstance);
                        setUserId(anonUser.user.uid);
                    }
                    setIsAuthReady(true);
                }
            });

            return () => unsubscribeAuth();
        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setIsAuthReady(true); // Still mark as ready even on error
        }
    }, []);

    // 2. Firestore Real-time Listener
    useEffect(() => {
        if (!isAuthReady || !db) return;

        const wordsColRef = collection(db, `/artifacts/${appId}/public/data/words`);
        const wordsQuery = query(wordsColRef); // No need for orderBy to avoid index issues

        const unsubscribe = onSnapshot(wordsQuery, (snapshot) => {
            const wordsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            // Sort client-side by dateAdded (newest first)
            wordsList.sort((a, b) => b.dateAdded.seconds - a.dateAdded.seconds);
            setWords(wordsList);
        }, (error) => {
            console.error("Firestore Listener Error:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, db]);

    const handleSelectWord = (id) => {
        setSelectedWordId(id);
    };

    const handleBack = () => {
        setSelectedWordId(null);
    };

    const selectedWordData = words.find(w => w.id === selectedWordId);
    
    const isAppLoading = !isAuthReady || !db;

    const currentView = selectedWordId && selectedWordData ? (
        <WordDetail 
            wordData={selectedWordData} 
            db={db} 
            onBack={handleBack} 
        />
    ) : (
        <WordList 
            words={words} 
            onSelectWord={handleSelectWord} 
            db={db} 
            userId={userId} 
        />
    );


    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-100'} text-gray-100`}>
            {/* Header / Nav */}
            <header className="sticky top-0 z-10 bg-slate-950 border-b border-slate-700 shadow-xl">
                <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-2xl font-black text-sky-400">
                        <span className="hidden sm:inline">Vocabulary Tracker</span>
                        <span className="sm:hidden">Vocab Tracker</span>
                    </h1>
                    <div className="flex items-center space-x-4">
                        <p className="text-sm text-slate-500 hidden sm:block">
                            User ID: <span className="font-mono text-slate-400">{userId || 'Connecting...'}</span>
                        </p>
                        {/* Theme Toggle - Currently only dark is supported/requested */}
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700 bg-slate-800"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto py-8">
                {isAppLoading ? (
                    <LoadingIndicator message="Connecting to database and authenticating..." />
                ) : (
                    currentView
                )}
            </main>
        </div>
    );
}