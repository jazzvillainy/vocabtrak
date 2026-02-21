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
      ensureDetailsFetched();
    }
  }, [wordData, ensureDetailsFetched, isFetching]);

  const displayData = {
    ...wordData,
    ...(localDetails || {}),
  };
  const isLoading = isFetching || wordData.isFetchingDetails;

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
