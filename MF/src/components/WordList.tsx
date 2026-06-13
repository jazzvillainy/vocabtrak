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
    <div className="space-y-lg section">
      <AddWordForm
        db={db}
        userId={userId}
        isCollapsed={isFormCollapsed}
        toggleCollapse={toggleCollapse}
      />

      <h2 className="section-title">Your Vocabulary List ({words.length})</h2>

      {words.length === 0 ? (
        <div className="empty-state">
          <BookOpen className="w-12 h-12 mx-auto mb-md icon" />
          <p>Your word list is empty!</p>
          <p className="text-muted mt-md">
            Click "Add New Word" to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-lg">
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
