'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, Upload, ArrowLeft, RotateCcw, Check, RefreshCw } from 'lucide-react';
import {
  parseFlashDeck,
  starterDeck,
  newWordSession,
  rateWord,
  type FlashDeck,
  type WordSession,
} from './flashcards';
import { satVocabDecks } from './sat-vocab-decks';

type SavedDeck = FlashDeck & { id: string; session?: WordSession };
const storageKey = 'redbookprep-vocabulary';

const builtInDecks: SavedDeck[] = [
  { ...starterDeck, id: 'starter-v1' },
  ...satVocabDecks,
];

function isValidSession(s: WordSession | undefined, deck: FlashDeck): s is WordSession {
  if (!s) return false;
  return (
    Array.isArray(s.order) &&
    new Set(s.order).size === s.order.length &&
    s.order.every((id) => deck.cards.some((c) => c.id === id)) &&
    Number.isInteger(s.index) &&
    s.index >= 0 &&
    s.index <= s.order.length &&
    Boolean(s.answers) &&
    typeof s.answers === 'object' &&
    Object.values(s.answers).every((v) => typeof v === 'boolean')
  );
}

export function Vocabulary() {
  const [decks, setDecks] = useState<SavedDeck[]>(builtInDecks);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const store = useRef(decks);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (raw) {
        if (!Array.isArray(raw.decks)) throw Error();
        const savedById = new Map<string, SavedDeck>();
        for (const r of raw.decks as SavedDeck[]) {
          const deck = parseFlashDeck(r);
          if (typeof r.id !== 'string') throw Error();
          const validSession = isValidSession(r.session, deck) ? r.session : undefined;
          savedById.set(r.id, {
            ...deck,
            id: r.id,
            ...(validSession ? { session: validSession } : {}),
          });
        }
        const mergedBuiltIn = builtInDecks.map((builtIn) => {
          const saved = savedById.get(builtIn.id);
          if (!saved?.session) return builtIn;
          return { ...builtIn, session: saved.session };
        });
        const customImported = Array.from(savedById.values()).filter(
          (d) => !builtInDecks.some((b) => b.id === d.id)
        );
        const combined = [...mergedBuiltIn, ...customImported];
        setDecks(combined);
        store.current = combined;
        setSelected(
          typeof raw.selected === 'string' && combined.some((d) => d.id === raw.selected)
            ? raw.selected
            : null
        );
      }
    } catch {
      setError('Saved vocabulary could not be loaded. Import your deck again to continue.');
    }
    setReady(true);
  }, []);

  function persist(next: SavedDeck[], id = selected) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, decks: next, selected: id }));
      store.current = next;
      setDecks(next);
      setSelected(id);
      setError('');
      return true;
    } catch {
      setError('Your browser could not save vocabulary. Free some browser storage and try again.');
      return false;
    }
  }

  function open(id: string, restart = false, missed = false, jumpCardId?: string) {
    const all = store.current;
    const deck = all.find((d) => d.id === id);
    if (!deck) return;
    let session =
      restart || !deck.session
        ? newWordSession(deck.cards, missed ? deck.session?.answers : undefined)
        : deck.session;
    if (jumpCardId) {
      const idx = session.order.indexOf(jumpCardId);
      if (idx >= 0) {
        session = { ...session, index: idx, revealed: false };
      } else {
        const fresh = newWordSession(deck.cards);
        const freshIdx = fresh.order.indexOf(jumpCardId);
        session = freshIdx >= 0 ? { ...fresh, index: freshIdx, revealed: false } : fresh;
      }
    }
    persist(
      all.map((d) => (d.id === id ? { ...d, session } : d)),
      id
    );
  }

  function change(reducer: (s: WordSession) => WordSession) {
    const all = store.current;
    const d = all.find((item) => item.id === selected);
    if (!d?.session) return;
    const next = reducer(d.session);
    if (next !== d.session) {
      persist(all.map((deck) => (deck.id === d.id ? { ...deck, session: next } : deck)));
    }
  }

  async function importDeck(file: File) {
    setImporting(true);
    setNotice('');
    setError('');
    try {
      if (!file.name.toLowerCase().endsWith('.bbplus'))
        throw Error('Choose a .bbplus flashcard file.');
      if (file.size > 10 * 1024 * 1024) throw Error('The file exceeds the 10 MB limit.');
      const content = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(content.replace(/^\uFEFF/, ''));
      } catch {
        throw Error('This file does not contain valid .bbplus JSON.');
      }
      const parsed = parseFlashDeck(raw);
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(parsed))
      );
      const id = Array.from(new Uint8Array(digest))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      if (store.current.some((d) => d.id === id)) {
        setNotice('This deck is already in your vocabulary library.');
        return;
      }
      if (persist([...store.current, { ...parsed, id }], null)) {
        setNotice(`Imported “${parsed.title}” · ${parsed.cards.length} cards.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This deck could not be imported.');
    } finally {
      setImporting(false);
      if (input.current) input.current.value = '';
    }
  }

  const query = search.trim().toLowerCase();
  const filteredDecks = useMemo(
    () =>
      decks.filter((d) =>
        (
          d.title +
          ' ' +
          d.description +
          ' ' +
          d.cards.map((c) => c.front).join(' ')
        )
          .toLowerCase()
          .includes(query)
      ),
    [decks, query]
  );

  const matchingWords = useMemo(() => {
    if (query.length < 2) return [];
    const results: { deckId: string; deckTitle: string; cardId: string; front: string; back: string }[] = [];
    for (const d of decks) {
      for (const c of d.cards) {
        if (
          c.front.toLowerCase().includes(query) ||
          c.back.toLowerCase().includes(query)
        ) {
          results.push({
            deckId: d.id,
            deckTitle: d.title,
            cardId: c.id,
            front: c.front,
            back: c.back,
          });
          if (results.length >= 24) return results;
        }
      }
    }
    return results;
  }, [decks, query]);

  const deck = decks.find((d) => d.id === selected);
  const session = deck?.session;
  const card = deck?.cards.find((c) => c.id === session?.order[session.index]);
  const finished = !!session && session.index >= session.order.length;
  const known = Object.values(session?.answers || {}).filter(Boolean).length;
  const learning = Object.values(session?.answers || {}).filter((v) => !v).length;

  return (
    <section className="vocabulary">
      <input
        ref={input}
        type="file"
        hidden
        accept=".bbplus"
        aria-label="Import flashcard deck"
        onChange={(e) => {
          if (e.target.files?.[0]) void importDeck(e.target.files[0]);
        }}
      />
      <div className="rb-page-heading">
        <div>
          <span className="eyebrow">A LITTLE RECALL, EVERY DAY</span>
          <h1>Vocabulary</h1>
          <p>
            Learn a word. Recall its meaning. Return to what needs practice. Includes 999 SAT
            vocabulary cards across {decks.length} decks.
          </p>
        </div>
        <button
          className="primary"
          disabled={!ready || importing}
          onClick={() => input.current?.click()}
        >
          <Upload size={17} />
          {importing ? 'Importing…' : 'Import .bbplus'}
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {deck && session ? (
        <>
          <div className="vocab-review-header">
            <button onClick={() => persist(store.current, null)}>
              <ArrowLeft size={16} />
              All decks
            </button>
            <div>
              <h2>{deck.title}</h2>
              <small>
                {finished
                  ? 'Review complete'
                  : `Card ${session.index + 1} of ${session.order.length}`}{' '}
                · {known} known · {learning} learning
              </small>
            </div>
          </div>
          <progress
            className="vocab-progress"
            aria-label="Cards reviewed"
            max={session.order.length || 1}
            value={session.index}
          />
          {finished ? (
            <section className="card vocab-complete">
              <Check size={34} />
              <h2>You made room for {session.order.length} words.</h2>
              <p>
                {known} known · {learning} still learning
              </p>
              <div className="rb-actions">
                {learning > 0 && (
                  <button className="primary" onClick={() => open(deck.id, true, true)}>
                    <RefreshCw size={16} />
                    Review learning cards
                  </button>
                )}
                <button onClick={() => open(deck.id, true)}>
                  <RotateCcw size={16} />
                  Study all cards again
                </button>
                <button onClick={() => persist(store.current, null)}>Back to decks</button>
              </div>
            </section>
          ) : (
            card && (
              <>
                <article className="card vocab-flashcard" aria-live="polite">
                  <span className="eyebrow">
                    {session.revealed ? 'MEANING / BACK' : 'WORD / FRONT'}
                  </span>
                  <div
                    className="vocab-card-content"
                    key={card.id + (session.revealed ? 'back' : 'front')}
                  >
                    <h2>{session.revealed ? card.back : card.front}</h2>
                    {(session.revealed ? card.backImage : card.frontImage) && (
                      <img
                        src={session.revealed ? card.backImage : card.frontImage}
                        alt={
                          (session.revealed ? card.backAlt : card.frontAlt) ||
                          'Flashcard illustration'
                        }
                      />
                    )}
                  </div>
                  {!session.revealed ? (
                    <p>Try recalling the meaning before revealing it.</p>
                  ) : (
                    <button onClick={() => change((s) => ({ ...s, revealed: false }))}>
                      Show word again
                    </button>
                  )}
                </article>
                <div className="vocab-rating">
                  {!session.revealed ? (
                    <button
                      className="primary"
                      onClick={() => change((s) => ({ ...s, revealed: true }))}
                    >
                      Reveal meaning
                    </button>
                  ) : (
                    <>
                      <button onClick={() => change((s) => rateWord(s, false))}>
                        <RefreshCw size={16} />
                        Still learning
                      </button>
                      <button
                        className="primary"
                        onClick={() => change((s) => rateWord(s, true))}
                      >
                        <Check size={16} />
                        I know this
                      </button>
                    </>
                  )}
                </div>
              </>
            )
          )}
        </>
      ) : (
        <>
          <p className="vocab-help">
            Study the built-in SAT vocabulary decks or import RedBook+ flashcard decks in .bbplus
            format. Decks and review progress stay in this browser.
          </p>
          <label className="vocab-search">
            Find a deck or word
            <input
              type="search"
              placeholder="Search vocabulary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="vocab-decks">
            {filteredDecks.map((d) => {
              const reviewed = d.session?.index || 0;
              return (
                <article className="card vocab-deck" key={d.id}>
                  <BookOpen size={28} />
                  <h2>{d.title}</h2>
                  <p>{d.description || 'Imported flashcard deck'}</p>
                  <small>
                    {d.cards.length} cards · {reviewed} reviewed
                  </small>
                  <button
                    className="primary"
                    disabled={!ready}
                    onClick={() => open(d.id)}
                  >
                    {d.session
                      ? d.session.index >= d.session.order.length
                        ? 'See results'
                        : 'Resume review'
                      : 'Start learning'}
                  </button>
                </article>
              );
            })}
          </div>

          {matchingWords.length > 0 && (
            <div className="vocab-word-results">
              <div className="rb-section-heading">
                <h2>Matching words</h2>
                <span>Showing {matchingWords.length}{matchingWords.length === 24 ? '+' : ''} matches</span>
              </div>
              <div className="vocab-word-list">
                {matchingWords.map((m) => (
                  <article className="card vocab-word-row" key={m.cardId}>
                    <div>
                      <span className="eyebrow">{m.deckTitle}</span>
                      <h3>{m.front}</h3>
                      <p>{m.back.split('\n')[0]}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => open(m.deckId, false, false, m.cardId)}
                    >
                      Open card
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {!filteredDecks.length && (
            <p>No matching decks. Try a different word or import a .bbplus deck.</p>
          )}
        </>
      )}
    </section>
  );
}
