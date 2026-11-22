'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Check, X, RotateCcw, Upload, Trophy } from 'lucide-react';
import type { FlashDeck } from './flashcards';

function shortMeaning(back: string): string {
  const firstLine = back.split('\n')[0] || back;
  return firstLine.replace(/^\([^)]+\)\s*/, '').trim();
}

export function VocabLearnMode({
  cards,
  onMarkWord,
}: {
  cards: FlashDeck['cards'];
  onMarkWord: (cardId: string, known: boolean) => void;
}) {
  const sample = useMemo(() => [...cards].sort(() => Math.random() - 0.5).slice(0, 12), [cards]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const cur = sample[idx];
  const choices = useMemo(() => {
    if (!cur) return [];
    const correctText = shortMeaning(cur.back);
    const distractors = cards
      .filter((c) => c.id !== cur.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => shortMeaning(c.back));
    return [correctText, ...distractors].sort(() => Math.random() - 0.5);
  }, [cur, cards]);

  if (!cur) {
    return (
      <section className="card vocab-complete">
        <Trophy size={36} />
        <h2>Learn Sprint Complete</h2>
        <p>
          You scored {score} / {sample.length} correctly.
        </p>
        <button type="button" className="primary" onClick={() => { setIdx(0); setScore(0); setSelected(null); }}>
          <RotateCcw size={15} /> Practice another 12 words
        </button>
      </section>
    );
  }

  const correctMeaning = shortMeaning(cur.back);
  const pick = (choiceText: string) => {
    if (selected !== null) return;
    setSelected(choiceText);
    const ok = choiceText === correctMeaning;
    if (ok) setScore((s) => s + 1);
    onMarkWord(cur.id, ok);
  };

  return (
    <section className="card rb-vocab-mode-card">
      <div className="rb-vocab-mode-head">
        <span className="eyebrow">ADAPTIVE LEARN · {idx + 1} / {sample.length}</span>
        <small>{score} correct</small>
      </div>
      <h2 className="rb-vocab-word-big">{cur.front}</h2>
      <div className="options-container" style={{ marginTop: '14px' }}>
        {choices.map((cText, i) => {
          const isChosen = selected === cText;
          const isRight = selected !== null && cText === correctMeaning;
          const isWrong = isChosen && cText !== correctMeaning;
          return (
            <div
              key={cText + i}
              className={`answer-option-row ${isChosen ? 'selected' : ''} ${
                isRight ? 'rb-opt-right' : isWrong ? 'rb-opt-wrong' : ''
              }`}
              onClick={() => pick(cText)}
            >
              <button type="button" className="option-select-area" disabled={selected !== null}>
                <span className="option-letter-circle">{'ABCD'[i]}</span>
                <span className="option-text-span">{cText}</span>
              </button>
            </div>
          );
        })}
      </div>
      {selected !== null && (
        <div className="rb-actions" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '.85rem' }}>
            {selected === correctMeaning ? (
              <strong className="text-emerald-500">Exact match!</strong>
            ) : (
              <span>Correct: {correctMeaning}</span>
            )}
          </span>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setSelected(null);
              setIdx((v) => v + 1);
            }}
          >
            Next word →
          </button>
        </div>
      )}
    </section>
  );
}

export function VocabMatchMode({ cards }: { cards: FlashDeck['cards'] }) {
  const [roundSeed, setRoundSeed] = useState(0);
  const [pickedTerm, setPickedTerm] = useState<string | null>(null);
  const [pickedDef, setPickedDef] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [bestTimeSec, setBestTimeSec] = useState<number | null>(null);

  const pairCards = useMemo(() => {
    void roundSeed;
    return [...cards].sort(() => Math.random() - 0.5).slice(0, 6);
  }, [cards, roundSeed]);

  const shuffledDefs = useMemo(() => {
    return [...pairCards].sort(() => Math.random() - 0.5);
  }, [pairCards]);

  const allDone = pairCards.length > 0 && matchedIds.length === pairCards.length;

  useEffect(() => {
    if (allDone) {
      const secs = Number(((Date.now() - startedAt) / 1000).toFixed(1));
      setBestTimeSec((prev) => (prev === null || secs < prev ? secs : prev));
      return;
    }
    const t = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => window.clearInterval(t);
  }, [allDone, startedAt]);

  useEffect(() => {
    if (!pickedTerm || !pickedDef) return;
    if (pickedTerm === pickedDef) {
      setMatchedIds((prev) => [...prev, pickedTerm]);
    }
    const timer = window.setTimeout(() => {
      setPickedTerm(null);
      setPickedDef(null);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [pickedTerm, pickedDef]);

  const restart = () => {
    setMatchedIds([]);
    setPickedTerm(null);
    setPickedDef(null);
    setElapsedMs(0);
    setStartedAt(Date.now());
    setRoundSeed((s) => s + 1);
  };

  return (
    <section className="card rb-vocab-mode-card">
      <div className="rb-vocab-mode-head">
        <span className="eyebrow">TIMED MATCH · PAIR 6 TERMS &amp; DEFINITIONS</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <strong>{(elapsedMs / 1000).toFixed(1)}s</strong>
          {bestTimeSec !== null && <small>Best: {bestTimeSec}s</small>}
        </div>
      </div>

      {allDone ? (
        <div className="vocab-complete" style={{ padding: '24px 0' }}>
          <Trophy size={32} />
          <h2>Board Cleared in {(elapsedMs / 1000).toFixed(1)}s!</h2>
          <button type="button" className="primary" onClick={restart}>
            <RotateCcw size={15} /> New round
          </button>
        </div>
      ) : (
        <div className="rb-match-grid">
          <div className="rb-match-col">
            {pairCards.map((c) => {
              const isMatched = matchedIds.includes(c.id);
              return (
                <button
                  key={'t-' + c.id}
                  type="button"
                  disabled={isMatched}
                  className={`rb-match-tile ${pickedTerm === c.id ? 'is-picked' : ''} ${
                    isMatched ? 'is-matched' : ''
                  }`}
                  onClick={() => setPickedTerm(c.id)}
                >
                  {c.front}
                </button>
              );
            })}
          </div>
          <div className="rb-match-col">
            {shuffledDefs.map((c) => {
              const isMatched = matchedIds.includes(c.id);
              return (
                <button
                  key={'d-' + c.id}
                  type="button"
                  disabled={isMatched}
                  className={`rb-match-tile is-def ${pickedDef === c.id ? 'is-picked' : ''} ${
                    isMatched ? 'is-matched' : ''
                  }`}
                  onClick={() => setPickedDef(c.id)}
                >
                  {shortMeaning(c.back)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function VocabSentenceAndCustomMode({
  activeCard,
  onImportCustomDeck,
}: {
  activeCard?: FlashDeck['cards'][number];
  onImportCustomDeck: (title: string, pairs: { front: string; back: string }[]) => void;
}) {
  const [sentence, setSentence] = useState('');
  const [feedback, setFeedback] = useState('');
  const [checking, setChecking] = useState(false);

  const [deckTitle, setDeckTitle] = useState('');
  const [rawPaste, setRawPaste] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const checkSentence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !sentence.trim()) return;
    setChecking(true);
    setFeedback('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Gemini 3.5 Flash',
          effort: 'Low',
          message: `Evaluate this SAT student's original sentence for the vocabulary word "${activeCard.front}" (meaning: ${shortMeaning(
            activeCard.back
          )}). Rate if usage is Idiomatic/Accurate or Needs Adjustment, and give 1 short suggestion.\nSentence: "${sentence}"`,
        }),
      });
      const data = await res.json();
      setFeedback(data.reply || data.error || 'Could not grade sentence right now.');
    } catch {
      setFeedback('Network error while checking sentence with redCoach.');
    } finally {
      setChecking(false);
    }
  };

  const handleBulkImport = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = rawPaste
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const pairs = lines
      .map((line) => {
        const sep = line.includes('\t') ? '\t' : line.includes(' - ') ? ' - ' : ',';
        const idx = line.indexOf(sep);
        if (idx <= 0) return null;
        return { front: line.slice(0, idx).trim(), back: line.slice(idx + sep.length).trim() };
      })
      .filter((p): p is { front: string; back: string } => Boolean(p && p.front && p.back));

    if (!pairs.length) {
      setImportMsg('Paste lines formatted as "word[TAB]definition" or "word - definition".');
      return;
    }
    onImportCustomDeck(deckTitle.trim() || 'Custom Quizlet Import', pairs);
    setDeckTitle('');
    setRawPaste('');
    setImportMsg(`Added ${pairs.length} cards to your custom vocabulary library!`);
  };

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      {activeCard && (
        <section className="card rb-vocab-mode-card">
          <span className="eyebrow">AI SENTENCE CHECKER · {activeCard.front.toUpperCase()}</span>
          <p style={{ margin: '6px 0 12px' }}>
            Write an original Digital SAT-style sentence using <strong>{activeCard.front}</strong> ({shortMeaning(activeCard.back)}):
          </p>
          <form onSubmit={checkSentence} style={{ display: 'grid', gap: '10px' }}>
            <textarea
              rows={2}
              placeholder={`Write a sentence using "${activeCard.front}"…`}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
            />
            <button type="submit" className="primary" disabled={checking || !sentence.trim()}>
              <Sparkles size={15} />
              <span>{checking ? 'Checking with redCoach…' : 'Check Usage with AI'}</span>
            </button>
          </form>
          {feedback && <div className="rb-ai-sentence-feedback">{feedback}</div>}
        </section>
      )}

      <section className="card rb-vocab-mode-card">
        <span className="eyebrow">CUSTOM DECK / QUIZLET PASTE IMPORTER</span>
        <p style={{ margin: '6px 0 12px' }}>
          Paste vocabulary exported from Quizlet (one per line: <code>term [tab] definition</code> or <code>term - definition</code>).
        </p>
        <form onSubmit={handleBulkImport} style={{ display: 'grid', gap: '10px' }}>
          <input
            type="text"
            placeholder="Deck title (e.g. College Board Bluebook Practice 4 Words)"
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
          />
          <textarea
            rows={4}
            placeholder={'ephemeral\tlasting for a very short time\npragmatic\tdealing with things sensibly and realistically'}
            value={rawPaste}
            onChange={(e) => setRawPaste(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!rawPaste.trim()}>
            <Upload size={15} />
            <span>Create Custom Deck</span>
          </button>
        </form>
        {importMsg && <p role="status" style={{ margin: '10px 0 0', fontSize: '.85rem' }}>{importMsg}</p>}
      </section>
    </div>
  );
}
