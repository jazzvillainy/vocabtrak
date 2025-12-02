import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { WordListProps } from "../types";
import { AddWordForm } from "./AddWordForm";
import { WordItem } from "./WordItem";

export const WordList: React.FC<WordListProps> = ({
  words,
  onSelectWord,
  db,
  userId,
}) => {
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
