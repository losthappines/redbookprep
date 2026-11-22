'use client';

import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'A – D', desc: 'Select answer choice A, B, C, or D' },
  { keys: 'Alt + 1–4', desc: 'Strike through / restore choice A–D' },
  { keys: 'Enter', desc: 'Submit answer (Check answer)' },
  { keys: '→ / ←', desc: 'Next or previous question in module' },
  { keys: 'F', desc: 'Flag / unflag current question for review' },
  { keys: 'G', desc: 'Toggle Desmos Calculator (Math)' },
  { keys: 'H', desc: 'Toggle Highlight / Erase mode' },
  { keys: 'P', desc: 'Toggle RedBook Predict (hide choices first)' },
  { keys: '?', desc: 'Open or close this keyboard shortcuts sheet' },
  { keys: 'Esc', desc: 'Close open dialogs, menus, or calculator' },
];

export function SolverShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="navigator-backdrop" onClick={onClose}>
      <section
        className="question-navigator"
        role="dialog"
        aria-modal="true"
        aria-label="Practice player keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="navigator-heading">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Keyboard size={20} /> Keyboard Shortcuts
            </h2>
            <p>Move faster through drills without lifting your hands off the keyboard.</p>
          </div>
          <button type="button" autoFocus aria-label="Close shortcuts dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="rb-shortcuts-list">
          {SHORTCUTS.map((item) => (
            <div className="rb-shortcut-row" key={item.keys}>
              <kbd className="rb-kbd">{item.keys}</kbd>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
