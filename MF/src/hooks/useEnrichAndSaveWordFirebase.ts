import { useState } from "react";
import { fetchWordDetailsFromGemini } from "../api/gemini";
import type { GeminiDetails } from "../types";
import { Firestore, collection, addDoc, Timestamp } from "firebase/firestore";

type SaveParams = {
  word: string;
  userId?: string | null;
  userContext?: string;
  collectionPath?: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

export const useEnrichAndSaveWordFirebase = (db: Firestore | null) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (params: SaveParams) => {
    const {
      word,
      userId = null,
      userContext = "",
      collectionPath = "words",
      geminiApiKey,
      geminiModel,
    } = params;

    setError(null);
    if (!db) throw new Error("Firestore `db` is required.");
    if (!word || !word.trim()) throw new Error("Word is required.");

    setLoading(true);
    try {
      const details: GeminiDetails = await fetchWordDetailsFromGemini(
        word.trim(),
        userContext.trim() || "No context specified",
        geminiApiKey,
        geminiModel,
      );

      console.log("Gemini details (parsed):", details);
      if (details.error) setError(details.error);

      const payload = {
        word: word.trim(),
        userContext: userContext.trim() || "No context specified",
        dateAdded: Timestamp.now(),
        userId,
        definition: details.definition,
        partOfSpeech: details.partOfSpeech,
        transcription: details.transcription,
        examples: details.examples || [],
        isFetchingDetails: false,
      } as Record<string, unknown>;

      console.log("Firestore payload to insert:", payload);

      const docRef = await addDoc(collection(db, collectionPath), payload);
      console.log("Inserted Firestore docRef:", docRef.id || docRef);
      return { docRef, details } as { docRef: any; details: GeminiDetails };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { save, loading, error } as const;
};

export default useEnrichAndSaveWordFirebase;
