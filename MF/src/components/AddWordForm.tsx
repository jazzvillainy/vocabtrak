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
          `/artifacts/${firebaseConfig.projectId}/public/data/words`,
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
        },
      );

      // Immediately fetch details from Gemini and store locally
      try {
        const details = await fetchWordDetailsFromGemini(
          word.trim(),
          context.trim() || "No context specified",
        );
        console.log("Gemini details returned:", details);
        // include basic meta and timestamp
        const payload = {
          id: docRef.id,
          word: word.trim(),
          fetchedAt: new Date().toISOString(),
          details,
        };
        console.log("Local payload to save:", payload);
        try {
          localStorage.setItem(
            `word-details-${docRef.id}`,
            JSON.stringify(payload),
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
    <div className="card">
      <button
        onClick={toggleCollapse}
        className="w-full text-left flex-between transition-colors hover:bg-surface-hover rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <h2 className="flex items-center">
          {isCollapsed ? (
            <Plus className="w-5 h-5 mr-md icon" />
          ) : (
            <Minus className="w-5 h-5 mr-md icon" />
          )}
          Add New Word of the Day
        </h2>
        <span className="text-muted">
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 icon" />
          ) : (
            <ChevronUp className="w-5 h-5 icon" />
          )}
        </span>
      </button>

      <div
        className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${
          isCollapsed ? "max-h-0" : "max-h-[500px]"
        }`}
      >
        <form onSubmit={handleSubmit} className="pt-lg space-y-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label htmlFor="word">Word</label>
              <input
                id="word"
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                required
                placeholder="e.g., Ephemeral"
              />
            </div>
            <div>
              <label htmlFor="context">Context Heard/Used In</label>
              <input
                id="context"
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Read in an old philosophy book"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !word.trim()}
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin icon" />
            ) : (
              <Zap className="w-5 h-5 icon" />
            )}
            {isSubmitting ? "Adding..." : "Add Word"}
          </button>

          {message && (
            <p className="text-sm text-center text-success mt-md">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
};
