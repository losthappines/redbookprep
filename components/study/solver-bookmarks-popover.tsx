'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bookmark, Check, Plus } from 'lucide-react';
import type { QuestionCollection } from './collections';

export function CollectionBookmarkButton({
  questionId,
  collections,
  onToggle,
  onCreate,
}: {
  questionId: string;
  collections: QuestionCollection[];
  onToggle: (collectionId: string, questionId: string) => void;
  onCreate: (name: string, initialQuestionId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const savedInCount = collections.filter((c) => c.questionIds.includes(questionId)).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className={`flag-question-btn ${savedInCount > 0 ? 'flagged' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bookmark size={14} className={savedInCount > 0 ? 'fill-current' : ''} />
        <span>{savedInCount > 0 ? `Saved (${savedInCount})` : 'Save'}</span>
      </button>

      {open && (
        <div className="header-dropdown-menu rb-collection-popover" role="dialog" aria-label="Add question to collection">
          <div className="rb-collection-title">Add to collection</div>
          <div className="rb-collection-list">
            {collections.map((col) => {
              const checked = col.questionIds.includes(questionId);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onToggle(col.id, questionId)}
                  className={checked ? 'is-checked' : ''}
                >
                  <span className="rb-collection-check">{checked && <Check size={12} />}</span>
                  <span>{col.name}</span>
                  <small>{col.questionIds.length}</small>
                </button>
              );
            })}
          </div>
          <form
            className="rb-collection-create"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              onCreate(newName.trim(), questionId);
              setNewName('');
            }}
          >
            <input
              type="text"
              placeholder="New collection…"
              maxLength={40}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" aria-label="Create collection" disabled={!newName.trim()}>
              <Plus size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
