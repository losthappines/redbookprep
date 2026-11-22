// Local-first question Collections (bookmarks), Personal Question Notes, and Passage Highlights.

export interface QuestionCollection {
  id: string;
  name: string;
  questionIds: string[];
  createdAt: string;
}

const COLLECTIONS_KEY = 'redbookprep-collections';
const QUESTION_NOTES_KEY = 'redbookprep-question-notes';
const HIGHLIGHTS_KEY = 'redbookprep-highlights';

const DEFAULT_COLLECTIONS: QuestionCollection[] = [
  { id: 'col-starred', name: 'Starred for Review', questionIds: [], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'col-hard', name: 'Hardest Tricky Traps', questionIds: [], createdAt: '2026-01-01T00:00:00Z' },
];

export function loadCollections(): QuestionCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return DEFAULT_COLLECTIONS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_COLLECTIONS;
  } catch {
    return DEFAULT_COLLECTIONS;
  }
}

export function saveCollections(collections: QuestionCollection[]) {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  } catch {}
}

export function loadQuestionNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(QUESTION_NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveQuestionNote(questionId: string, note: string) {
  try {
    const all = loadQuestionNotes();
    if (!note.trim()) {
      delete all[questionId];
    } else {
      all[questionId] = note;
    }
    localStorage.setItem(QUESTION_NOTES_KEY, JSON.stringify(all));
    return all;
  } catch {
    return {};
  }
}

export function loadHighlights(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveHighlights(all: Record<string, string[]>) {
  try {
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
  } catch {}
}
