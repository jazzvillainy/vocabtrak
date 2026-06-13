import React, { useState, useCallback, useEffect } from "react";
import { ChevronUp, BookOpen } from "lucide-react";
import { WordDetailProps, GeminiDetails } from "../types";
import { formatDate } from "../utils/dateUtils";
import { fetchWordDetailsFromGemini } from "../api/gemini";
import { LoadingIndicator } from "./LoadingIndicator";
import { DetailCard } from "./DetailCard";
// (no firestore document writes; details are cached locally)

export const WordDetail: React.FC<WordDetailProps> = ({ wordData, onBack }) => {
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [localDetails, setLocalDetails] = useState<GeminiDetails | null>(null);

  const ensureDetailsFetched = useCallback(async () => {
    if (!wordData?.id || isFetching) return;

    // Try localStorage first
    try {
      const raw = localStorage.getItem(`word-details-${wordData.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLocalDetails(parsed.details || parsed);
        return;
      }
    } catch (e) {
      console.error("Failed to read local details:", e);
    }

    setIsFetching(true);
    setError(null);

    const details = await fetchWordDetailsFromGemini(
      wordData.word,
      wordData.userContext,
    );

    if (details) {
      // Save to localStorage for later quick access
      const payload = {
        id: wordData.id,
        word: wordData.word,
        fetchedAt: new Date().toISOString(),
        details,
      };
      try {
        localStorage.setItem(
          `word-details-${wordData.id}`,
          JSON.stringify(payload),
        );
        setLocalDetails(details);
      } catch (e) {
        console.error("Failed to save word details to localStorage:", e);
      }
    }

    if (details.error) {
      setError(details.error);
    }

    setIsFetching(false);
  }, [wordData, isFetching]);

  useEffect(() => {
    if (wordData && !isFetching) {
      // call in a microtask to avoid synchronous setState within the effect
      const t = setTimeout(() => {
        void ensureDetailsFetched();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [wordData, ensureDetailsFetched, isFetching]);

  const displayData = {
    ...wordData,
    ...(localDetails || {}),
  };
  const isLoading = isFetching || wordData.isFetchingDetails;

  return (
    <div className="space-y-lg section">
      <button
        onClick={onBack}
        className="flex items-center accent hover:opacity-90 transition-opacity font-medium mb-lg"
      >
        <ChevronUp className="w-5 h-5 rotate-90 mr-md icon" />
        Back to Word List
      </button>

      <header className="border-b border-border pb-lg">
        <h1 className="text-4xl font-extrabold">{displayData.word}</h1>
        <p className="text-muted mt-md flex items-center">
          <BookOpen className="w-4 h-4 mr-sm icon" />
          Added: {formatDate(displayData.dateAdded)}
        </p>
        <p className="text-sm text-muted mt-sm">
          <span className="font-semibold">User ID: </span>
          {displayData.userId}
        </p>
      </header>

      {(error || displayData.error) && (
        <div className="bg-error/10 border border-error text-error p-md rounded-lg">
          <p className="font-semibold">Error Fetching Details:</p>
          <p className="text-sm">{error || displayData.error}</p>
        </div>
      )}

      {isLoading && !(error || displayData.error) ? (
        <LoadingIndicator
          message={`Fetching definition and examples for "${displayData.word}"...`}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-lg">
          <DetailCard title="Definition">
            <p className="text-lg">
              {displayData.definition ||
                "Definition not yet fetched or available."}
            </p>
          </DetailCard>

          <DetailCard title="Original Context">
            <p className="italic text-lg text-muted">
              "{displayData.userContext || "No context provided."}"
            </p>
          </DetailCard>

          <DetailCard
            title="Grammatical Details"
            className="col-span-1 md:col-span-2"
          >
            <div className="flex flex-wrap gap-lg">
              <span className="bg-accent/10 text-accent px-md py-sm rounded-full text-sm font-mono border border-accent">
                Part of Speech:{" "}
                <span className="font-bold">
                  {displayData.partOfSpeech || "N/A"}
                </span>
              </span>
              <span className="bg-surface text-muted px-md py-sm rounded-full text-sm font-mono border border-border">
                Transcription:{" "}
                <span className="font-bold">
                  {displayData.transcription || "N/A"}
                </span>
              </span>
            </div>
          </DetailCard>

          <DetailCard title="Examples" className="col-span-1 md:col-span-2">
            {displayData.examples && displayData.examples.length > 0 ? (
              <ul className="list-disc list-inside space-y-md">
                {displayData.examples.map((ex, index) => (
                  <li key={index}>{ex}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                No examples found or provided by the API.
              </p>
            )}
          </DetailCard>
        </div>
      )}
    </div>
  );
};
