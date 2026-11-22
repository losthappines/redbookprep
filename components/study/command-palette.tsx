'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowRight, BookOpen, Sparkles, X } from 'lucide-react';
import type { PracticeQuestion } from './bbplus';

export function CommandPalette({
  open,
  questions,
  navItems,
  onClose,
  onNavigateTab,
  onStartQuestion,
}: {
  open: boolean;
  questions: PracticeQuestion[];
  navItems: readonly { key: string; label: string }[];
  onClose: () => void;
  onNavigateTab: (tabKey: string) => void;
  onStartQuestion: (index: number) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const skillEntries = useMemo(() => {
    const map = new Map<string, { skill: string; section: string; firstIdx: number; count: number }>();
    questions.forEach((q, idx) => {
      const existing = map.get(q.skill);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(q.skill, { skill: q.skill, section: q.section, firstIdx: idx, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [questions]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matchedTabs = navItems.filter((n) => !q || n.label.toLowerCase().includes(q));
  const matchedSkills = skillEntries
    .filter((s) => !q || s.skill.toLowerCase().includes(q) || s.section.toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <div className="navigator-backdrop" onClick={onClose}>
      <section
        className="question-navigator rb-cmd-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Global workspace search"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rb-cmd-input-row">
          <Search size={18} />
          <input
            autoFocus
            type="search"
            placeholder="Jump to a tab, SAT skill, mock exam, or calculator…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" aria-label="Close search" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="rb-cmd-results">
          {matchedTabs.length > 0 && (
            <div className="rb-cmd-group">
              <span className="eyebrow">WORKSPACE VIEWS</span>
              {matchedTabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigateTab(item.key);
                    onClose();
                  }}
                >
                  <Sparkles size={14} />
                  <span>{item.label}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}

          {matchedSkills.length > 0 && (
            <div className="rb-cmd-group">
              <span className="eyebrow">PRACTICE BY SKILL</span>
              {matchedSkills.map((s) => (
                <button
                  key={s.skill}
                  type="button"
                  onClick={() => {
                    onStartQuestion(s.firstIdx);
                    onClose();
                  }}
                >
                  <BookOpen size={14} />
                  <span>
                    {s.skill} <small>({s.count} Qs)</small>
                  </span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
