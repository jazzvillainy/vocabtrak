import React, { useState } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import {
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Zap,
  Loader2,
} from "lucide-react";
import { AddWordFormProps } from "../types";
import { fetchWordDetailsFromGemini } from "../api/gemini";
import { firebaseConfig } from "../config/firebase";

export const AddWordForm: React.FC<AddWordFormProps> = ({
  db,
  userId,
  isCollapsed,
  toggleCollapse,
}) => {
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
      // Add metadata to Firestore and capture doc id
      const docRef = await addDoc(
        collection(
          db,
          `/artifacts/${firebaseConfig.projectId}/public/data/words`
        ),
        {
          word: word.trim(),
          userContext: context.trim() || "No context specified",
          dateAdded: Timestamp.now(),
          userId: userId,
          definition: null,
          partOfSpeech: null,
          transcription: null,
          examples: [],
          isFetchingDetails: false,
        }
      );

      // Immediately fetch details from Gemini and store locally
      try {
        const details = await fetchWordDetailsFromGemini(
          word.trim(),
          context.trim() || "No context specified"
        );
        // include basic meta and timestamp
        const payload = {
          id: docRef.id,
          word: word.trim(),
          fetchedAt: new Date().toISOString(),
          details,
        };
        try {
          localStorage.setItem(
            `word-details-${docRef.id}`,
            JSON.stringify(payload)
          );
        } catch (e) {
          console.error("Failed to save word details to localStorage:", e);
        }
      } catch (e) {
        console.error("Gemini fetch failed after adding word:", e);
      }

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
