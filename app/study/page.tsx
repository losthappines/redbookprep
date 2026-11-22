'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import './redbook.css';
import {GraphCalculator} from '@/components/study/graph-calculator';
import {useRedbookSidebar} from '@/components/study/use-redbook-sidebar';
import {useStudyDialog} from '@/components/study/use-study-dialog';
import {SprInput} from '@/components/study/spr-input';
import {MathText, SafeSvgDiagram} from '@/components/study/math-text';
import {SolverShortcutsModal} from '@/components/study/solver-shortcuts-modal';
import {SolverFeedbackAddons} from '@/components/study/solver-feedback-addons';
import {CollectionBookmarkButton} from '@/components/study/solver-bookmarks-popover';
import {
  loadCollections,
  saveCollections,
  loadQuestionNotes,
  saveQuestionNote,
  loadHighlights,
  saveHighlights,
  type QuestionCollection,
} from '@/components/study/collections';
import {HabitTopbarCluster} from '@/components/study/habit-topbar-cluster';
import {RedBookRush} from '@/components/study/redbook-rush';
import {MockExamView} from '@/components/study/mock-exam-view';
import {MistakesAndSavedHub} from '@/components/study/mistakes-saved-hub';
import {ActivityHeatmapAnalytics} from '@/components/study/progress-heatmap';
import {AdaptivePlanner} from '@/components/study/adaptive-planner';
import {CommandPalette} from '@/components/study/command-palette';
import {PricingModal} from '@/components/study/pricing-modal';
import {
  DEFAULT_HABITS,
  loadHabits,
  saveHabits,
  loadDailyState,
  saveDailyState,
  recordStudyDayInHabits,
  computeAchievements,
  type HabitProfile,
  type DailyDropState,
} from '@/lib/habits';
import {playTone} from '@/lib/sound-fx';
import {evaluateSprResponse, validateSprInput} from '@/lib/sat-spr';
import {PanelLeft, Search, Play, Download, UserRound, ArrowUpRight, Sun, Moon, Eye, Menu, SlidersHorizontal, Highlighter, Keyboard, StickyNote, Sparkles as SparkleIcon, Zap, GraduationCap, Shield} from 'lucide-react';
import {parseBbplus, type PracticeQuestion} from '@/components/study/bbplus';
import {StudyDashboard} from '@/components/study/study-dashboard';
import {
  isCloudConfigured,
  normalizeSlipCause,
  pushCloudState,
  signInWithGoogle,
  signOutCloud,
  subscribeAuthSync,
} from '@/lib/supabase';
import {StudyBubbleBackground} from '@/components/study/study-bubble-background';
import {LiquidNavbar, type NimbusFx} from '@/components/ui/liquid-glass-navbar';
import {AnimatePresence, motion} from 'motion/react';
import {Vocabulary} from '@/components/study/vocabulary';
import {QuestionBank} from '@/components/study/question-bank';
import {PracticeFolders} from '@/components/study/practice-folders';
import {RedCoachChat} from '@/components/study/redcoach-chat';
import {LessonsView} from '@/components/study/lessons-view';
import {formatSkillTitle} from '@/lib/format-skill';
import {
  LayoutDashboard,
  BookOpen,
  AlertCircle,
  Calendar,
  TrendingUp,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Flag,
  Clock,
  Calculator as CalcIcon,
  FileText,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Minus,
  Maximize2,
  HelpCircle,
  PenTool,
  BookmarkCheck,
  Sparkles,
  Info
} from 'lucide-react';

const navItems: readonly { key: string; label: string; icon: typeof LayoutDashboard; fx: NimbusFx }[] = [
  { key: 'Home', label: 'Dashboard', icon: LayoutDashboard, fx: 'glow' },
  { key: 'Ask redCoach', label: 'Ask redCoach', icon: Sparkles, fx: 'plane' },
  { key: 'Lessons', label: 'Lessons', icon: BookmarkCheck, fx: 'pop' },
  { key: 'Mock tests', label: 'Mock tests', icon: GraduationCap, fx: 'pop' },
  { key: 'Practice', label: 'Practice', icon: BookOpen, fx: 'pop' },
  { key: 'Question bank', label: 'Question bank', icon: FileText, fx: 'spin' },
  { key: 'Vocabulary', label: 'Vocabulary', icon: BookOpen, fx: 'wave' },
  { key: 'Mistakes', label: 'Mistakes', icon: AlertCircle, fx: 'drop' },
  { key: 'Planner', label: 'Planner', icon: Calendar, fx: 'pop' },
  { key: 'Progress', label: 'Progress', icon: TrendingUp, fx: 'glow' },
  { key: 'Settings', label: 'Settings', icon: SettingsIcon, fx: 'spin' }
];

const domains = [
  'Information and Ideas',
  'Craft and Structure',
  'Expression of Ideas',
  'Standard English Conventions',
  'Algebra',
  'Advanced Math',
  'Problem-Solving and Data Analysis',
  'Geometry and Trigonometry'
];

const SLIP_CAUSES = ['Concept Gap', 'Misread Question', 'Calculation Slip', 'Guessed'] as const;

const sampleQuestions: PracticeQuestion[] = [];

type Attempt = {
  id: string;
  choice: number;
  sprResponse?: string;
  isCorrect?: boolean;
  seconds: number;
  date: string;
  review: string;
  note: string;
  cause: string;
};

type UserProfile = {
  name: string;
  email: string;
  targetScore: number;
  testDate?: string;
  avatar?: string; uid?: string; isCloud?: boolean;
};

export default function Page() {
  const [questions,setQuestions] = useState<PracticeQuestion[]>(sampleQuestions);
  const [packsLoading,setPacksLoading] = useState(true);
  const [activeModule,setActiveModule] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const q = questions[index];
  const effectiveModuleId = activeModule ?? q?.moduleId ?? null;
  const moduleQuestions = effectiveModuleId
    ? questions.filter(item => item.moduleId === effectiveModuleId)
    : (q ? [q] : []);
  const libraryQuestions = questions
    .filter((item,i)=>!item.moduleId||questions.findIndex(other=>other.moduleId===item.moduleId)===i)
    .map(item=>({...item,questionCount:item.moduleId?questions.filter(other=>other.moduleId===item.moduleId).length:1}));

  const shellRef=useRef<HTMLElement>(null);
  const openSidebarRef=useRef<HTMLButtonElement>(null);
  const closeSidebarRef=useRef<HTMLButtonElement>(null);
  const moreMenuRef=useRef<HTMLDivElement>(null);
  const moreBtnRef=useRef<HTMLButtonElement>(null);
  const pendingSolveRef=useRef(false);
  const [mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
  const [smallViewport,setSmallViewport]=useState(false); const [portraitDock,setPortraitDock]=useState(false); useEffect(()=>{const mqPortrait=matchMedia('(orientation: portrait), (max-aspect-ratio: 1/1), (max-width: 900px)');const sync=()=>setPortraitDock(mqPortrait.matches);sync();mqPortrait.addEventListener('change',sync);window.addEventListener('resize',sync);return()=>{mqPortrait.removeEventListener('change',sync);window.removeEventListener('resize',sync)}},[]);
  useEffect(()=>{const media=matchMedia('(max-width:720px)');const sync=()=>setSmallViewport(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);
  const [solidGlass,setSolidGlass]=useState(false);
  const [highContrast,setHighContrast]=useState(false);
  const [accent,setAccent]=useState('amber');
  const [focusPractice,setFocusPractice]=useState(false);
  const [readingSplit,setReadingSplit]=useState(50);

  const questionDrafts = useRef<
    Record<number, { choice: number | null; sprResponse?: string; submitted: boolean; started: number; note: string }>
  >({});
  const [sprResponse, setSprResponse] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [predictMode, setPredictMode] = useState(false);
  const [predictText, setPredictText] = useState('');
  const [predictRevealed, setPredictRevealed] = useState(false);
  const [highlighterOn, setHighlighterOn] = useState(false);
  const [highlights, setHighlights] = useState<Record<string, string[]>>({});
  const [collections, setCollections] = useState<QuestionCollection[]>([]);
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});
  const [calcExpressions, setCalcExpressions] = useState<string[] | undefined>(undefined);
  const [habits, setHabits] = useState<HabitProfile>(DEFAULT_HABITS);
  const [dailyDrop, setDailyDrop] = useState<DailyDropState | null>(null);
  const [rushOpen, setRushOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [moduleStage, setModuleStage] = useState<'' | 'review' | 'finished'>('');
  const moduleFinished = useRef(false);
  const moduleHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {if (moduleStage === 'finished') moduleHeading.current?.focus();}, [moduleStage]);
  const [lineReader, setLineReader] = useState(false);
  const [lineReaderPos, setLineReaderPos] = useState(120);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [showTime, setShowTime] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [readingSize, setReadingSize] = useState('standard');
  const [reduced, setReduced] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('All sections');
  const [view, setView] = useState('Home');
  const [opened, setOpened] = useState(false);
  const [domainFilter, setDomainFilter] = useState('All domains');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(Date.now());
  const [storageError, setStorageError] = useState('');

  // Practice Experience State:
  const [leftTab, setLeftTab] = useState<'passage' | 'reference' | 'notes' | 'scratchpad'>('passage');
  const [eliminated, setEliminated] = useState<Record<string, number[]>>({});
  const [showCalculator, setShowCalculator] = useState(false);
  const [showRefSheetModal, setShowRefSheetModal] = useState(false);

  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    setCollections(loadCollections());
    setQuestionNotes(loadQuestionNotes());
    setHighlights(loadHighlights());
    setHabits(loadHabits());
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      setDailyDrop(loadDailyState(questions));
    }
  }, [questions]);

  // Global Ctrl/Cmd+K command palette shortcut
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  // Auto switch left tab and reset per-question UI toggles when changing questions
  useEffect(() => {
    setLeftTab('passage');
    setPredictRevealed(false);
    setPredictText('');
    setCalcExpressions(undefined);
    if (q?.section !== 'Reading and Writing') {
      setLineReader(false);
    }
  }, [index, q?.section]);

  // Escape & outside-click handling for Practice player's More dropdown
  useEffect(() => {
    if (!showTools) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowTools(false);
        moreBtnRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowTools(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [showTools]);

  // Timer
  useEffect(() => {
    if (!opened || submitted) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [opened, submitted, started]);

  // Settings
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('redbookprep-settings') || '{}');
      setCollapsed(Boolean(p.collapsed));
      setTheme(['light', 'dark', 'system'].includes(p.theme) ? p.theme : 'light');
      setReadingSize(p.readingSize === 'large' ? 'large' : 'standard');
      setReduced(Boolean(p.reduced));
      setSolidGlass(Boolean(p.solidGlass));setHighContrast(Boolean(p.highContrast));setFocusPractice(Boolean(p.focusPractice));setReadingSplit(Number.isFinite(p.readingSplit)?Math.max(30,Math.min(70,p.readingSplit)):50);setAccent(['amber','azure','silver'].includes(p.accent)?p.accent:'amber');
    } catch {}
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    try{localStorage.setItem('redbookprep-settings', JSON.stringify({ collapsed, theme, readingSize, reduced,solidGlass,highContrast,accent,focusPractice,readingSplit }));void pushCloudState();}catch{setStorageError('Your settings could not be saved.');}
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const nextTheme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = nextTheme;document.documentElement.classList.toggle('dark', nextTheme === 'dark');document.documentElement.style.colorScheme = nextTheme;
      setIsDarkTheme(nextTheme === 'dark');
      document.documentElement.dataset.reading = readingSize;
      document.documentElement.dataset.motion = reduced ? 'reduced' : 'normal';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [collapsed, theme, readingSize, reduced,solidGlass,highContrast,accent,focusPractice,readingSplit,prefsReady]);

  const isPlayerActive = opened && Boolean(q) && moduleQuestions.length > 0 && view === 'Practice';
  useRedbookSidebar(shellRef,portraitDock||smallViewport?!mobileSidebarOpen:collapsed,reduced,prefsReady,isPlayerActive);
  const closeStudyDialog=useCallback(()=>{setShowNavigator(false);setShowRefSheetModal(false);setMobileSidebarOpen(false);setShowTools(false);setModuleStage('');if(moduleFinished.current)setOpened(false)},[]);
  useStudyDialog(showNavigator||showRefSheetModal||mobileSidebarOpen||Boolean(moduleStage),closeStudyDialog);
  const switchView=(next:string)=>{setView(next);setMobileSidebarOpen(false);setShowTools(false);if(next==='Practice')setOpened(false);window.scrollTo({top:0,behavior:'instant'})};
  const toggleSidebar=()=>{if(portraitDock||matchMedia('(max-width:720px)').matches){setMobileSidebarOpen(v=>!v)}else{setCollapsed(v=>!v);requestAnimationFrame(()=>collapsed?closeSidebarRef.current?.focus():openSidebarRef.current?.focus())}};
  const exportStudy=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,attempts},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='redbookprep-study-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  useEffect(()=>{if(ready){const params=new URLSearchParams({tab:view==='Home'?'dashboard':view.toLowerCase().replaceAll(' ','-')});if(view==='Practice'&&(opened||pendingSolveRef.current))params.set('solve','true');window.history.replaceState(null,'','/study?'+params.toString())}},[view,opened,ready]);

  // Initial load
  useEffect(() => {
    const initialParams = new URLSearchParams(window.location.search);
    const wantsSolve =
      initialParams.get('tab')?.toLowerCase() === 'practice' &&
      initialParams.get('solve') === 'true';
    if (wantsSolve) {
      pendingSolveRef.current = true;
    }

    const questions = sampleQuestions;
    setQuestions(questions);
    setPacksLoading(true);
    void (async () => {
      const builtInPacks = [
        { url: '/packs/satoplam-reading/topic-01-main-ideas.bbplus?v=1', key: 'satoplam-main-ideas' },
        { url: '/packs/satoplam-reading/topic-02-details.bbplus?v=1', key: 'satoplam-details' },
        { url: '/packs/satoplam-reading/topic-03-inference.bbplus?v=1', key: 'satoplam-inference' },
        { url: '/packs/satoplam-reading/topic-04-evidence-support.bbplus?v=1', key: 'satoplam-evidence-support' },
        { url: '/packs/satoplam-reading/topic-05-evidence-weaken.bbplus?v=1', key: 'satoplam-evidence-weaken' },
        { url: '/packs/satoplam-reading/topic-06-quotation.bbplus?v=1', key: 'satoplam-quotation' },
        { url: '/packs/satoplam-reading/topic-07-evidence-graphs.bbplus?v=1', key: 'satoplam-evidence-graphs' },
        { url: '/packs/satoplam-reading/topic-08-main-purpose.bbplus?v=1', key: 'satoplam-main-purpose' },
        { url: '/packs/satoplam-reading/topic-09-overall-structure.bbplus?v=1', key: 'satoplam-overall-structure' },
        { url: '/packs/satoplam-reading/topic-10-underlined-purpose.bbplus?v=1', key: 'satoplam-underlined-purpose' },
        { url: '/packs/satoplam-reading/topic-11-cross-text-connections.bbplus?v=1', key: 'satoplam-cross-text-connections' },
        { url: '/packs/satoplam-reading/topic-12-words-in-context-gap-filling.bbplus?v=1', key: 'satoplam-words-in-context-gap-filling' },
        { url: '/packs/satoplam-reading/topic-13-words-in-context-synonyms.bbplus?v=1', key: 'satoplam-words-in-context-synonyms' },
        { url: '/packs/satoplam-writing/topic-01-boundaries.bbplus?v=1', key: 'satoplam-writing-boundaries' },
        { url: '/packs/satoplam-writing/topic-02-form-structure-and-sense.bbplus?v=1', key: 'satoplam-writing-form-structure-and-sense' },
        { url: '/packs/satoplam-writing/topic-03-transitions.bbplus?v=1', key: 'satoplam-writing-transitions' },
        { url: '/packs/satoplam-writing/topic-04-rhetorical-synthesis.bbplus?v=1', key: 'satoplam-writing-rhetorical-synthesis' },
        { url: '/packs/mathbook-3/algebra.bbplus?v=2', key: 'mathbook3-algebra' },
        { url: '/packs/mathbook-3/advanced-math.bbplus?v=2', key: 'mathbook3-advanced-math' },
        { url: '/packs/mathbook-3/problem-solving.bbplus?v=2', key: 'mathbook3-problem-solving' },
        { url: '/packs/mathbook-3/geometry-trigonometry.bbplus?v=2', key: 'mathbook3-geometry-trigonometry' }
      ];
      try {
        const fetched = await Promise.all(
          builtInPacks.map(async ({ url, key }) => {
            const res = await fetch(url);
            if (!res.ok) return [];
            const raw = await res.json();
            return parseBbplus(raw, key);
          })
        );
        const builtInQuestions = fetched.flat();
        if (builtInQuestions.length) {
          setQuestions((old) => [
            ...old.filter((item) => !String(item.materialTitle || '').startsWith('SAToplam') && !String(item.materialTitle || '').startsWith('Mathbook 3.0')),
            ...builtInQuestions
          ]);

          let restoredIndex = 0;
          let restoredModuleId: string | null = builtInQuestions[0]?.moduleId ?? null;
          try {
            const draft = JSON.parse(localStorage.getItem('redbookprep-draft') || 'null');
            if (draft) {
              let matchIdx = -1;
              if (typeof draft.questionId === 'string') {
                matchIdx = builtInQuestions.findIndex((item) => item.id === draft.questionId);
              }
              if (matchIdx < 0 && Number.isInteger(draft.index) && builtInQuestions[draft.index]) {
                matchIdx = draft.index;
              }
              if (matchIdx >= 0 && Number.isFinite(draft.started)) {
                restoredIndex = matchIdx;
                restoredModuleId = builtInQuestions[matchIdx]?.moduleId ?? restoredModuleId;
                setIndex(matchIdx);
                setActiveModule(restoredModuleId);
                setChoice(
                  Number.isInteger(draft.choice) && draft.choice >= 0 && draft.choice < 4
                    ? draft.choice
                    : null
                );
                setSprResponse(typeof draft.sprResponse === 'string' ? draft.sprResponse : '');
                setStarted(draft.started);
                setSubmitted(Boolean(draft.submitted));
                setSessionNote(typeof draft.note === 'string' ? draft.note : '');
                const saved = draft.questions || {};
                for (const [key, value] of Object.entries(saved)) {
                  const entry = value as {choice: number | null; sprResponse?: string; submitted: boolean; started: number; note: string};
                  if (builtInQuestions[Number(key)] && entry && (entry.choice === null || (Number.isInteger(entry.choice) && entry.choice >= 0 && entry.choice < 4)) && Number.isFinite(entry.started)) {
                    questionDrafts.current[Number(key)] = {...entry, sprResponse: typeof entry.sprResponse === 'string' ? entry.sprResponse : '', submitted: Boolean(entry.submitted), note: typeof entry.note === 'string' ? entry.note : ''};
                  }
                }
                setFlagged(Array.isArray(draft.flagged) ? draft.flagged.filter((id: string) => builtInQuestions.some(item => item.id === id)) : []);
                moduleFinished.current = draft.finished === true;
              }
            }
          } catch {}

          if (pendingSolveRef.current) {
            pendingSolveRef.current = false;
            setActiveModule(restoredModuleId);
            setIndex(restoredIndex);
            setView('Practice');
            setOpened(true);
            if (moduleFinished.current) setModuleStage('finished');
          }
        }
      } catch {
      } finally {
        setPacksLoading(false);
      }
    })();

    try {
      const u = JSON.parse(localStorage.getItem('redbookprep-user') || 'null');
      if (u) setUser(u);
    } catch {}

    try {
      const data = JSON.parse(localStorage.getItem('redbookprep-demo') || '[]');
      if (Array.isArray(data)) {
        setAttempts(
          data
            .filter(
              (a) =>
                a &&
                (questions.some((q) => q.id === a.id) || (typeof a.id === 'string' && (a.id.startsWith('bbplus-mathbook3-') || a.id.startsWith('bbplus-satoplam-')))) &&
                ((Number.isInteger(a.choice) && a.choice >= 0 && a.choice < 4) || typeof a.sprResponse === 'string')
            )
            .map((a) => ({
              ...a,
              note: typeof a.note === 'string' ? a.note : '',
              cause: normalizeSlipCause(a.cause),
              seconds: Number.isFinite(a.seconds) ? Math.max(0, a.seconds) : 0,
              review: typeof a.review === 'string' ? a.review : '',
              date: typeof a.date === 'string' ? a.date : ''
            }))
        );
      }

      const draft = JSON.parse(localStorage.getItem('redbookprep-draft') || 'null');
      if (
        draft &&
        Number.isInteger(draft.index) &&
        questions[draft.index] &&
        Number.isFinite(draft.started)
      ) {
        setIndex(draft.index);
        setActiveModule(questions[draft.index].moduleId ?? null);
        setChoice(
          Number.isInteger(draft.choice) && draft.choice >= 0 && draft.choice < 4
            ? draft.choice
            : null
        );
        setStarted(draft.started);
        setSubmitted(Boolean(draft.submitted));
        setSessionNote(typeof draft.note === 'string' ? draft.note : '');
        const saved = draft.questions || {};
        for (const [key, value] of Object.entries(saved)) {
          const entry = value as {choice: number | null; submitted: boolean; started: number; note: string};
          if (questions[Number(key)] && entry && (entry.choice === null || (Number.isInteger(entry.choice) && entry.choice >= 0 && entry.choice < 4)) && Number.isFinite(entry.started)) {
            questionDrafts.current[Number(key)] = {...entry, submitted: Boolean(entry.submitted), note: typeof entry.note === 'string' ? entry.note : ''};
          }
        }
        setFlagged(Array.isArray(draft.flagged) ? draft.flagged.filter((id: string) => questions.some(item => item.id === id)) : []);
        moduleFinished.current = draft.finished === true;
        if (draft.finished === true && new URLSearchParams(location.search).get('solve') === 'true') setModuleStage('finished');

      }

      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        const t = tab.toLowerCase();
        if (t === 'home' || t === 'dashboard') {
          setView('Home');
          setOpened(false);
        } else if (t === 'lessons') {
          setView('Lessons');
          setOpened(false);
        } else if (t === 'mock-tests' || t === 'tests') {
          setView('Mock tests');
          setOpened(false);
        } else if (t === 'rush') {
          setView('Practice');
          setOpened(false);
          setRushOpen(true);
        } else if (t === 'practice') {
          setView('Practice');
          if (params.get('solve') === 'true' && questions.length > 0) {
            setOpened(true);
          } else {
            setOpened(false);
          }
        } else if (t === 'vocabulary') {
          setView('Vocabulary');
          setOpened(false);
        } else if (t === 'question bank' || t === 'question-bank') {
          setView('Question bank');
          setOpened(false);
        } else if (t === 'mistakes') {
          setView('Mistakes');
          setOpened(false);
        } else if (t === 'planner') {
          setView('Planner');
          setOpened(false);
        } else if (t === 'progress') {
          setView('Progress');
          setOpened(false);
        } else if (t === 'settings') {
          setView('Settings');
          setOpened(false);
        }
      } else {
        setView('Home');
        setOpened(false);
      }
    } catch {
      setStorageError('Saved practice could not be loaded.');
    }
    setReady(true);
    return subscribeAuthSync((synced) => {
      if (synced.profile) setUser(synced.profile);
      if (Array.isArray(synced.attempts)) {
        setAttempts(synced.attempts.map((a) => ({ ...a, cause: normalizeSlipCause(a.cause) })));
      }
      const p = synced.settings;
      if (p && typeof p === 'object') {
        if (['light', 'dark', 'system'].includes(p.theme)) setTheme(p.theme);
        if (p.readingSize === 'large' || p.readingSize === 'standard') setReadingSize(p.readingSize);
        if (typeof p.reduced === 'boolean') setReduced(p.reduced);
        if (typeof p.solidGlass === 'boolean') setSolidGlass(p.solidGlass);
        if (typeof p.highContrast === 'boolean') setHighContrast(p.highContrast);
        if (['amber', 'azure', 'silver'].includes(p.accent)) setAccent(p.accent);
      }
    });
  }, []);

  // Save attempts
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem('redbookprep-demo', JSON.stringify(attempts));
        void pushCloudState({ attempts });
      } catch {
        setStorageError('Your browser could not save progress.');
      }
    }
  }, [attempts, ready]);

  // Save draft
  useEffect(() => {
    if (ready && opened && q) {
      try {
        questionDrafts.current[index] = {choice, sprResponse, submitted, started, note: sessionNote};
        localStorage.setItem(
          'redbookprep-draft',
          JSON.stringify({ index, questionId: q.id, moduleId: effectiveModuleId, choice, sprResponse, started, submitted, note: sessionNote, questions: questionDrafts.current, flagged, finished: moduleFinished.current })
        );
      } catch {
        setStorageError('Your unfinished answer could not be saved.');
      }
    }
  }, [ready, opened, q, effectiveModuleId, index, choice, sprResponse, started, submitted, sessionNote, flagged, moduleStage]);

  const isAttemptCorrect = useCallback((a: Attempt, item?: PracticeQuestion) => {
    if (typeof a.isCorrect === 'boolean') return a.isCorrect;
    if (!item) return false;
    if (item.questionType === 'spr') {
      return evaluateSprResponse(a.sprResponse || '', item.sprAnswers || []);
    }
    return a.choice === item.answer;
  }, []);

  const currentQuestionCorrect = Boolean(
    q &&
      (q.questionType === 'spr'
        ? evaluateSprResponse(sprResponse, q.sprAnswers || [])
        : choice === q.answer)
  );

  const canSubmitCurrent = Boolean(
    q &&
      (q.questionType === 'spr'
        ? Boolean(sprResponse.trim()) && validateSprInput(sprResponse).valid
        : choice !== null)
  );

  const mistakes = attempts.filter((a) => !isAttemptCorrect(a, questions.find((item) => item.id === a.id)));
  const accuracy = attempts.length
    ? Math.round((100 * (attempts.length - mistakes.length)) / attempts.length)
    : 0;

  const reviewQueue = questions.flatMap((item) => {
    const rows = attempts.filter((a) => a.id === item.id);
    const last = rows[rows.length - 1];
    return last && !isAttemptCorrect(last, item) ? [last] : [];
  });
  const due = reviewQueue.filter((a) => !a.review || a.review <= today);

  function start(i: number) {
    questionDrafts.current = {};
    moduleFinished.current = false;
    setModuleStage('');
    setFlagged([]);
    setEliminated({});
    setActiveModule(questions[i]?.moduleId ?? null);
    setShowNavigator(false);
    setOpened(true);
    setIndex(i);
    setChoice(null);
    setSprResponse('');
    setSubmitted(false);
    setStarted(Date.now());
    setElapsed(0);
    setShowTools(false);
    setShowNote(false);
    setSessionNote('');
    setView('Practice');
  }

  function navigateQuestion(i: number) {
    if (i < 0 || i >= questions.length) return;
    if (moduleFinished.current) {setModuleStage('finished');return;}
    setModuleStage('');
    questionDrafts.current[index] = { choice, sprResponse, submitted, started, note: sessionNote };
    const draft = questionDrafts.current[i];
    setShowNavigator(false);
    setIndex(i);
    setChoice(draft?.choice ?? null);
    setSprResponse(draft?.sprResponse ?? '');
    setSubmitted(draft?.submitted ?? false);
    setStarted(draft?.started ?? Date.now());
    setSessionNote(draft?.note ?? '');
    setShowNote(false);
    setShowTools(false);
    setOpened(true);
    setView('Practice');
  }

  function closeModuleReview() {
    setModuleStage('');
    if (moduleFinished.current) setOpened(false);
  }

  function reviewModule() {
    questionDrafts.current[index] = {choice, sprResponse, submitted, started, note: sessionNote};
    setShowNavigator(false);
    setShowCalculator(false);
    setModuleStage(moduleFinished.current ? 'finished' : 'review');
  }

  function nextQuestion() {
    const position=q?moduleQuestions.findIndex(item=>item.id===q.id):-1;
    if (position === moduleQuestions.length - 1) reviewModule();
    else navigateQuestion(questions.findIndex(item=>item.id===moduleQuestions[position+1]?.id));
  }

  const rawModulePosition=q?moduleQuestions.findIndex(item=>item.id===q.id):0;
  const modulePosition=rawModulePosition>=0?rawModulePosition:0;
  const moduleAnswers = moduleQuestions.map((item) => {const i=questions.findIndex(other=>other.id===item.id);return ({
    question: item,
    draft: i === index ? {choice, sprResponse, submitted, started, note: sessionNote} : questionDrafts.current[i],
  })});
  const isDraftAnswered = (item: PracticeQuestion, d?: {choice: number | null; sprResponse?: string}) =>
    item.questionType === 'spr' ? Boolean(d?.sprResponse?.trim()) : d?.choice != null;
  const isDraftCorrect = (item: PracticeQuestion, d?: {choice: number | null; sprResponse?: string}) =>
    item.questionType === 'spr'
      ? evaluateSprResponse(d?.sprResponse || '', item.sprAnswers || [])
      : d?.choice === item.answer;
  const moduleAnswered = moduleAnswers.filter(item => isDraftAnswered(item.question, item.draft)).length;
  const moduleCorrect = moduleAnswers.filter(item => isDraftAnswered(item.question, item.draft) && isDraftCorrect(item.question, item.draft)).length;

  function finishModule() {
    if (moduleFinished.current) return;
    const now = Date.now();
    questionDrafts.current[index] = {choice, sprResponse, submitted, started, note: sessionNote};
    const pending: Attempt[] = [];
    moduleQuestions.forEach((item) => {
      const i=questions.findIndex(other=>other.id===item.id);
      const draft = questionDrafts.current[i];
      if (!draft || !isDraftAnswered(item, draft) || draft.submitted) return;
      const correct = isDraftCorrect(item, draft);
      pending.push({
        id: item.id,
        choice: item.questionType === 'spr' ? -1 : (draft.choice ?? 0),
        sprResponse: item.questionType === 'spr' ? (draft.sprResponse || '').trim() : undefined,
        isCorrect: correct,
        seconds: Math.max(0, Math.round((now - draft.started) / 1000)),
        date: new Date(now).toISOString(),
        review: new Date(now + 86400000).toISOString().slice(0, 10),
        note: draft.note,
        cause: ''
      });
      questionDrafts.current[i] = {...draft, submitted: true};
    });
    moduleFinished.current = true;
    if (pending.length) setAttempts(old => [...old, ...pending]);
    if (canSubmitCurrent) setSubmitted(true);
    setModuleStage('finished');
  }

  function submit() {
    if (!q || !canSubmitCurrent || submitted || moduleFinished.current) return;
    const isSpr = q.questionType === 'spr';
    const ok = isSpr ? evaluateSprResponse(sprResponse, q.sprAnswers || []) : choice === q.answer;
    setAttempts((a) => [
      ...a,
      {
        id: q.id,
        choice: isSpr ? -1 : (choice ?? 0),
        sprResponse: isSpr ? sprResponse.trim() : undefined,
        isCorrect: ok,
        seconds: Math.round((Date.now() - started) / 1000),
        date: new Date().toISOString(),
        review: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        note: sessionNote || questionNotes[q.id] || '',
        cause: ''
      }
    ]);
    playTone(ok ? 'correct' : 'incorrect', habits.soundEnabled);
    setHabits((prev) => recordStudyDayInHabits(prev));
    if (dailyDrop && (q.id === dailyDrop.rwQuestionId || q.id === dailyDrop.mathQuestionId)) {
      const nextDaily: DailyDropState = {
        ...dailyDrop,
        rwCompleted: dailyDrop.rwCompleted || q.id === dailyDrop.rwQuestionId,
        mathCompleted: dailyDrop.mathCompleted || q.id === dailyDrop.mathQuestionId,
      };
      if (nextDaily.rwCompleted && nextDaily.mathCompleted && !nextDaily.bonusClaimed) {
        nextDaily.bonusClaimed = true;
        const reward = nextDaily.isChallengeSunday ? 4 : 2;
        setHabits((prev) => {
          const updated = { ...prev, sparksBalance: prev.sparksBalance + reward };
          saveHabits(updated);
          return updated;
        });
      }
      setDailyDrop(nextDaily);
      saveDailyState(nextDaily);
    }
    setSubmitted(true);
  }

  const handleToggleCollection = (collectionId: string, qId: string) => {
    setCollections((prev) => {
      const next = prev.map((c) => {
        if (c.id !== collectionId) return c;
        const exists = c.questionIds.includes(qId);
        return {
          ...c,
          questionIds: exists ? c.questionIds.filter((id) => id !== qId) : [...c.questionIds, qId],
        };
      });
      saveCollections(next);
      return next;
    });
  };

  const handleCreateCollection = (name: string, initialQId?: string) => {
    setCollections((prev) => {
      const next: QuestionCollection[] = [
        ...prev,
        {
          id: `col-${Date.now()}`,
          name,
          questionIds: initialQId ? [initialQId] : [],
          createdAt: new Date().toISOString(),
        },
      ];
      saveCollections(next);
      return next;
    });
  };

  const handleHighlightSelection = () => {
    if (!highlighterOn || !q) return;
    const sel = window.getSelection()?.toString().trim();
    if (!sel || sel.length < 2 || sel.length > 220) return;
    setHighlights((prev) => {
      const current = prev[q.id] || [];
      if (current.includes(sel)) return prev;
      const next = { ...prev, [q.id]: [...current, sel] };
      saveHighlights(next);
      return next;
    });
    window.getSelection()?.removeAllRanges();
  };

  // Solver Keyboard Shortcuts
  useEffect(() => {
    if (!isPlayerActive || showNavigator || Boolean(moduleStage) || showRefSheetModal || showCalculator) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (isTyping || showShortcuts) return;

      if (e.altKey && ['1', '2', '3', '4'].includes(e.key) && q?.questionType !== 'spr' && !submitted) {
        e.preventDefault();
        toggleEliminate(Number(e.key) - 1, { stopPropagation: () => {} } as any);
        return;
      }
      const upper = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upper) && !e.metaKey && !e.ctrlKey && q?.questionType !== 'spr' && !submitted && !(predictMode && !predictRevealed)) {
        const idx = 'ABCD'.indexOf(upper);
        if (q?.options[idx]) {
          e.preventDefault();
          setChoice(idx);
        }
        return;
      }
      if (upper === 'F' && !e.metaKey && !e.ctrlKey && q) {
        e.preventDefault();
        setFlagged((old) => (old.includes(q.id) ? old.filter((id) => id !== q.id) : [...old, q.id]));
      } else if (upper === 'G' && !e.metaKey && !e.ctrlKey && q?.section === 'Math') {
        e.preventDefault();
        setShowCalculator((v) => !v);
      } else if (upper === 'H' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHighlighterOn((v) => !v);
      } else if (upper === 'P' && !e.metaKey && !e.ctrlKey && q?.questionType !== 'spr' && !submitted) {
        e.preventDefault();
        setPredictMode((v) => !v);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextQuestion();
      } else if (e.key === 'ArrowLeft' && modulePosition > 0) {
        e.preventDefault();
        navigateQuestion(questions.findIndex((item) => item.id === moduleQuestions[modulePosition - 1]?.id));
      } else if (e.key === 'Enter' && !submitted && canSubmitCurrent) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function update(a: Attempt, patch: Partial<Attempt>) {
    setAttempts((old) => old.map((item) => (item === a ? { ...item, ...patch } : item)));
  }

  // Toggle Elimination for an answer choice
  function toggleEliminate(optIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!q) return; const currentList = eliminated[q.id] || [];
    if (currentList.includes(optIndex)) {
      setEliminated({ ...eliminated, [q.id]: currentList.filter((idx) => idx !== optIndex) });
    } else {
      setEliminated({ ...eliminated, [q.id]: [...currentList, optIndex] });
      // If eliminated choice was currently selected, unselect it
      if (choice === optIndex) {
        setChoice(null);
      }
    }
  }

  return (
    <main
      ref={shellRef}
      data-view={view}
      data-accent={accent}
      data-solid={solidGlass}
      data-contrast={highContrast}
      data-focus={focusPractice}
      style={{"--reading-split":`${readingSplit}%`} as React.CSSProperties}
      className={
        "redbook-app "+(mobileSidebarOpen?"mobile-sidebar-open ":"")+(portraitDock?"portrait-dock-mode ":"")+
        (collapsed ? 'sidebar-folded ' : '') +
        (isPlayerActive ? 'player-view' : 'dashboard-view')
      }
    >
      {!isPlayerActive && view !== 'Ask redCoach' && <StudyBubbleBackground reduced={reduced} highContrast={highContrast}/>}
      <header className="topbar">
        <span aria-hidden="true" style={{position:'absolute',inset:'0 0 -48px',zIndex:0,pointerEvents:'none',background:'transparent',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',maskImage:'linear-gradient(to bottom,black 0%,black 15%,#000c 40%,#0006 65%,#0002 85%,transparent 100%)',WebkitMaskImage:'linear-gradient(to bottom,black 0%,black 15%,#000c 40%,#0006 65%,#0002 85%,transparent 100%)'}} />
        <div className="rb-toolbar-start"><button ref={openSidebarRef} className="rb-icon-button rb-sidebar-open" aria-label="Open sidebar" aria-expanded={mobileSidebarOpen||!collapsed} onClick={toggleSidebar}><PanelLeft size={19}/></button><h2>{view==='Home'?'Dashboard':view==='Practice'?'Your Library':view}</h2></div>
        <div className="rb-toolbar-actions">
          <HabitTopbarCluster
            habits={habits}
            achievements={computeAchievements({
              habits,
              attempts,
              dailyState: dailyDrop || {
                date: today,
                isChallengeSunday: false,
                rwQuestionId: '',
                mathQuestionId: '',
                rwCompleted: false,
                mathCompleted: false,
                bonusClaimed: false,
              },
              sprCorrectCount: attempts.filter(
                (a) =>
                  questions.find((item) => item.id === a.id)?.questionType === 'spr' &&
                  isAttemptCorrect(a, questions.find((item) => item.id === a.id))
              ).length,
            })}
            onToggleSound={() => {
              setHabits((prev) => {
                const updated = { ...prev, soundEnabled: !prev.soundEnabled };
                saveHabits(updated);
                return updated;
              });
            }}
          />
          <button
            type="button"
            className="rb-habit-pill"
            title="Global search (Ctrl+K / ⌘K)"
            onClick={() => setCmdOpen(true)}
          >
            <Search size={14} />
            <span className="rb-hide-sm">Search</span>
            <kbd className="rb-kbd" style={{ padding: '1px 5px', fontSize: '.68rem' }}>⌘K</kbd>
          </button>
          <button className="rb-icon-button" aria-label={isDarkTheme?'Switch to light mode':'Switch to dark mode'} title={isDarkTheme?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(isDarkTheme?'light':'dark')}>{isDarkTheme?<Sun size={18}/>:<Moon size={18}/>}</button>
          {view==='Settings'?<span className="rb-saved"><span className="status-dot"/>{user?.isCloud||user?.uid?'Synced to cloud':'Saved on this device'}</span>:<button className="primary" onClick={()=>{setSearch('');setSection('All sections');setRushOpen(false);switchView(view==='Practice'?'Question bank':'Practice')}}><BookOpen size={17}/> {view==='Practice'?'Browse all skills':'Start practice'}</button>}
        </div>
      </header>
      {mobileSidebarOpen&&<button className="rb-mobile-scrim" aria-label="Close navigation" onClick={()=>setMobileSidebarOpen(false)}/>}
      <AnimatePresence>{portraitDock && !isPlayerActive && (<motion.div className="rb-floating-dock-wrapper" initial={{ y: 56, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 56, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}><LiquidNavbar compact tone={isDarkTheme ? 'dark' : 'light'} reducedMotion={reduced} ariaLabel="Portrait floating dock navigation" active={Math.max(0, navItems.findIndex((n) => n.key === view))} onChange={(idx) => { const target = navItems[idx]; if (target) switchView(target.key); }} items={navItems.map(({ key, label, icon: Icon, fx }) => ({ label, fx, icon: <Icon width={18} height={18} strokeWidth={1.85} />, badge: key === 'Mistakes' && reviewQueue.length > 0 ? reviewQueue.length : undefined }))} /></motion.div>)}</AnimatePresence>
      <aside className="sidebar" inert={portraitDock||smallViewport?!mobileSidebarOpen:collapsed} role={(portraitDock||smallViewport)&&mobileSidebarOpen?"dialog":undefined} aria-modal={(portraitDock||smallViewport)&&mobileSidebarOpen?true:undefined} aria-label="Study navigation">
        <div className="rb-side-brand"><a className="brand" href="/" aria-label="RedBookPrep home"><img src="/icon-192.png" alt="" width={39} height={39} className="brand-mark brand-mark-img"/><div><b>RedBookPrep</b><small>A little practice.<br/>More possibility.</small></div></a><button ref={closeSidebarRef} className="sidebar-toggle rb-icon-button" aria-label="Close sidebar" onClick={toggleSidebar}><PanelLeft size={19}/></button></div>
        <nav aria-label="Main navigation">{navItems.map(({key,label,icon:Icon})=><button key={key} aria-current={view===key?'page':undefined} className={view===key?'primary':''} onClick={()=>switchView(key)}><Icon size={20} strokeWidth={1.8}/><span className="nav-label">{label}</span>{key==='Mistakes'&&reviewQueue.length>0&&<span className="rb-count">{reviewQueue.length}</span>}</button>)}</nav>
        <label className="rb-side-search"><Search size={17}/><input aria-label="Search your practice library" placeholder="Search your library" value={search} onChange={e=>{setSearch(e.target.value);setView('Practice');setOpened(false)}}/></label>
        <div className="rb-side-bottom"><div className="side-foot"><span className="status-dot"/> {user?.isCloud||user?.uid?'Synced to cloud':'Saved on this device'}<small>{user?.email?`Signed in as ${user.email}`:'Sign in with Google or email in Settings to sync across devices.'}</small></div><button className="rb-profile" onClick={()=>switchView('Settings')}><span className="rb-avatar">{user?.name?.[0]?.toUpperCase()||'S'}</span><span><strong>{user?.name||'Student'}</strong><small>{user?.isCloud||user?.uid?'Cloud synced':'Local study profile'}</small></span></button><div className="rb-side-links"><a href="/about">About</a><a href="/contact">Contact</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></div>
      </aside>
      <div className="rb-page-content">
      {storageError && <p role="alert">{storageError}</p>}

      {!ready ? (
        <p>Loading your study space…</p>
      ) : (
        <>
          {/* ============================================================== */}
          {/* HOME / DASHBOARD VIEW */}
          {/* ============================================================== */}
          {view === 'Ask redCoach' && <RedCoachChat />}

          {view === 'Lessons' && (
            <LessonsView
              questions={questions}
              onStartQuestion={start}
              onPractice={() => switchView('Practice')}
              onDashboard={() => switchView('Home')}
            />
          )}

          {view === 'Mock tests' && (
            <MockExamView
              questions={questions}
              onOpenCalculator={() => setShowCalculator(true)}
              onSaveMockAttempts={(items) => {
                const now = new Date().toISOString();
                setAttempts((old) => [
                  ...old,
                  ...items.map((it) => ({
                    ...it,
                    date: now,
                    review: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                    note: 'From Mock Exam',
                    cause: '',
                  })),
                ]);
                setHabits((prev) => recordStudyDayInHabits(prev));
              }}
            />
          )}

          {view === 'Vocabulary' && <Vocabulary />}

          {view === 'Question bank' && <QuestionBank questions={questions} attempts={attempts} loading={packsLoading} onOpen={start} />}

          {view === 'Home' && (
            <>
              {dailyDrop && questions.length > 0 && (dailyDrop.rwQuestionId || dailyDrop.mathQuestionId) && (
                <section className="card rb-daily-drop-banner" style={{ marginBottom: '22px' }}>
                  <div>
                    <span className="eyebrow">
                      {dailyDrop.isChallengeSunday ? '⚡ CHALLENGE SUNDAY · 2× SPARKS BONUS' : 'TODAY’S DAILY 2 DROP'}
                    </span>
                    <h2>Daily R&amp;W + Math Pair</h2>
                    <p style={{ margin: '4px 0 0' }}>
                      {dailyDrop.rwCompleted && dailyDrop.mathCompleted
                        ? 'Both today’s Daily 2 questions completed! Streak preserved.'
                        : 'Finish both questions today to earn bonus Sparks and lock in your daily streak.'}
                    </p>
                  </div>
                  <div className="rb-actions">
                    {dailyDrop.rwQuestionId && (
                      <button
                        type="button"
                        className={dailyDrop.rwCompleted ? '' : 'primary'}
                        onClick={() => {
                          const idx = questions.findIndex((item) => item.id === dailyDrop.rwQuestionId);
                          if (idx >= 0) start(idx);
                        }}
                      >
                        {dailyDrop.rwCompleted ? '✓ Daily R&W Done' : 'Daily R&W →'}
                      </button>
                    )}
                    {dailyDrop.mathQuestionId && (
                      <button
                        type="button"
                        className={dailyDrop.mathCompleted ? '' : 'primary'}
                        onClick={() => {
                          const idx = questions.findIndex((item) => item.id === dailyDrop.mathQuestionId);
                          if (idx >= 0) start(idx);
                        }}
                      >
                        {dailyDrop.mathCompleted ? '✓ Daily Math Done' : 'Daily Math →'}
                      </button>
                    )}
                  </div>
                </section>
              )}
              <StudyDashboard attempts={attempts} questions={questions} user={user} due={due.length} onPractice={id=>{if(id){const i=questions.findIndex(item=>item.id===id);if(i>=0){start(i);return}}if(opened&&q&&!moduleFinished.current){setView('Practice')}else if(questions.length===0&&packsLoading){pendingSolveRef.current=true;setView('Practice')}else switchView('Practice')}} onProgress={()=>switchView('Progress')} onMistakes={()=>switchView('Mistakes')} />
            </>
          )}

          {/* ============================================================== */}
          {/* PRACTICE VIEW (LIBRARY OR REDESIGNED SOLVER) */}
          {/* ============================================================== */}
          {view === 'Practice' && (
            <>
              {packsLoading && questions.length === 0 ? (
                <>
                  <div className="rb-page-heading">
                    <div>
                      <span className="eyebrow">PRACTICE, AT YOUR PACE</span>
                      <h1>Your Library</h1>
                      <p>Preparing your Digital SAT practice modules and skills…</p>
                    </div>
                    <small>Loading modules…</small>
                  </div>
                  <div className="rb-skeleton-grid" aria-busy="true" aria-label="Loading practice modules">
                    {[0, 1, 2, 3].map((slot) => (
                      <div className="card rb-skeleton-card" key={slot}>
                        <div className="rb-skeleton-line" style={{width: '45%', height: '14px'}} />
                        <div className="rb-skeleton-line" style={{width: '78%', height: '24px', marginTop: '12px'}} />
                        <div className="rb-skeleton-line" style={{width: '60%', height: '14px', marginTop: '12px'}} />
                      </div>
                    ))}
                  </div>
                </>
              ) : rushOpen ? (
                <RedBookRush
                  questions={questions}
                  soundEnabled={habits.soundEnabled}
                  bestScore={habits.rushBestScore}
                  onRecordAttempt={(payload) => {
                    setAttempts((old) => [
                      ...old,
                      {
                        ...payload,
                        date: new Date().toISOString(),
                        review: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                        note: 'From RedBook Rush',
                        cause: '',
                      },
                    ]);
                    setHabits((prev) => recordStudyDayInHabits(prev));
                  }}
                  onSaveBest={(best) => {
                    setHabits((prev) => {
                      const updated = { ...prev, rushBestScore: Math.max(prev.rushBestScore, best) };
                      saveHabits(updated);
                      return updated;
                    });
                  }}
                  onClose={() => setRushOpen(false)}
                />
              ) : !opened || !q || !moduleQuestions.length ? (
                /* --- PRACTICE LIBRARY (COVERS) --- */
                <>
                  <div className="rb-page-heading"><div><span className="eyebrow">PRACTICE, AT YOUR PACE</span><h1>Your Library</h1><p>Pick up where you left off, or launch a timed RedBook Rush sprint.</p></div><div className="rb-actions"><button type="button" className="primary" onClick={() => setRushOpen(true)}><Zap size={15}/> RedBook Rush Arcade</button><small>{libraryQuestions.length} practice modules</small></div></div>
                  {(() => {
                    if (!q) return null; const qCompleted = attempts.filter((a) => a.id === q.id).length;
                    const hasStarted = qCompleted > 0;
                    return (
                      <section className="resume-card">
                        <div>
                          <span className="eyebrow">{hasStarted ? 'CONTINUE YOUR PRACTICE' : 'GET STARTED'}</span>
                          <h2>{formatSkillTitle(q.skill)}</h2>
                          <p>
                            {hasStarted
                              ? `${qCompleted} ${qCompleted === 1 ? 'question' : 'questions'} completed · Untimed sample`
                              : 'Untimed sample practice · Begin when you are ready'}
                          </p>
                        </div>
                        <button
                          className="primary"
                          onClick={() => {
                            setOpened(true);
                            if (moduleFinished.current) setModuleStage('finished');
                          }}
                        >
                          {hasStarted ? 'Resume' : 'Start'}
                        </button>
                      </section>
                    );
                  })()}

                  <PracticeFolders questions={libraryQuestions} search={search} section={section} theme={theme} onStart={i=>start(questions.findIndex(q=>q.id===libraryQuestions[i]?.id))} onSearch={setSearch} onSection={setSection} />

                </>
              ) : (
                /* --- REDESIGNED PRACTICE SOLVING WORKSPACE (INSPIRED BY BLUEPRINTS) --- */
                <div className="practice-workspace-root">
                  {/* 1. Header Toolbar */}
                  <header className="practice-header-bar">
                    <div className="header-left">
                      <button
                        className="back-library-btn"
                        onClick={() => {
                          setOpened(false);
                          setShowTools(false);
                          setShowCalculator(false);
                        }}
                        title="Return to library"
                      >
                        <ChevronLeft size={16} />
                        <span>Library</span>
                      </button>
                    </div>

                    <div className="header-center">
                      <div className="skill-title-cluster">
                        <strong className="skill-main-name">{q.skill}</strong>
                        <div className="skill-meta-tags">
                          <span className="meta-pill section-pill">{q.section}</span>
                          
                        </div>
                      </div>
                    </div>

                    <div className="header-right">
                      {/* Quiet Digital Timer */}
                      <div className="timer-wrapper">
                        {showTime && (
                          <div className="digital-timer-pill" aria-label="Elapsed time">
                            <Clock size={16} className="timer-icon" />
                            <span>
                              {Math.floor(elapsed / 60)
                                .toString()
                                .padStart(2, '0')}
                              :{(elapsed % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                        )}
                        <button
                          className="header-tool-btn"
                          onClick={() => setShowTime((v) => !v)}
                          title="Toggle timer visibility"
                        >
                          {showTime ? 'Hide timer' : 'Show timer'}
                        </button>
                      </div>

                      {/* Math Specific Tools: Formula Sheet & Calculator */}
                      {q.section === 'Math' && (
                        <>
                          <button
                            className={`header-tool-btn ${showCalculator ? 'active' : ''}`}
                            onClick={() => setShowCalculator((v) => !v)}
                            title="Open graphing calculator"
                            aria-controls="practice-graph-calculator"
                            aria-expanded={showCalculator}
                            aria-haspopup="dialog"
                          >
                            <CalcIcon size={14} />
                            <span>Calculator</span>
                          </button>
                          <button
                            className="header-tool-btn"
                            onClick={() => setShowRefSheetModal((v) => !v)}
                            title="SAT Reference Sheet"
                          >
                            <span>Reference</span>
                          </button>
                        </>
                      )}

                      {/* More / Display Settings Dropdown */}
                      <div className="relative" ref={moreMenuRef}>
                        <button
                          ref={moreBtnRef}
                          className={`header-tool-btn ${showTools ? 'active' : ''}`}
                          aria-expanded={showTools}
                          aria-haspopup="menu"
                          onClick={() => setShowTools((v) => !v)}
                        >
                          More
                        </button>
                        {showTools && (
                          <div className="header-dropdown-menu" role="menu" aria-label="Display settings">
                            <button
                              role="menuitem"
                              onClick={() => {
                                setReadingSize((v) => (v === 'large' ? 'standard' : 'large'));
                                setShowTools(false);
                              }}
                            >
                              {readingSize === 'large' ? 'Standard text size' : 'Larger text size'}
                            </button>
                            <button
                              role="menuitem"
                              onClick={() => {
                                setTheme((v) => (v === 'dark' ? 'light' : 'dark'));
                                setShowTools(false);
                              }}
                            >
                              Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </header>

                  {/* 2. Split Workspace Panels */}
                  <div className="practice-panels-container">
                    {/* LEFT PANEL: Passage / Math Reference / Scratchpad */}
                    <section className="practice-left-pane">
                      <div className="pane-header-strip">
                        <div className="pane-tab-group">
                          <button
                            className={`pane-tab-btn ${leftTab === 'passage' ? 'active' : ''}`}
                            onClick={() => setLeftTab('passage')}
                          >
                            <FileText size={14} />
                            <span>{q.section === 'Math' ? 'Problem Context' : 'Passage'}</span>
                          </button>
                          {q.section === 'Math' && (
                            <button
                              className={`pane-tab-btn ${leftTab === 'reference' ? 'active' : ''}`}
                              onClick={() => setLeftTab('reference')}
                            >
                              <span>SAT Formulas</span>
                            </button>
                          )}
                          <button
                            className={`pane-tab-btn ${leftTab === 'notes' ? 'active' : ''}`}
                            onClick={() => setLeftTab('notes')}
                          >
                            <StickyNote size={14} />
                            <span>Notes</span>
                          </button>
                          <button
                            className={`pane-tab-btn ${leftTab === 'scratchpad' ? 'active' : ''}`}
                            onClick={() => setLeftTab('scratchpad')}
                          >
                            <PenTool size={14} />
                            <span>Scratchpad</span>
                          </button>
                        </div>

                        <div className="pane-tools-sub" style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className={`pane-mini-toggle ${highlighterOn ? 'active' : ''}`}
                            onClick={() => setHighlighterOn((v) => !v)}
                            title="Highlight selected text (H)"
                          >
                            <Highlighter size={13} />
                            <span>{highlighterOn ? 'Highlighting' : 'Highlight'}</span>
                          </button>
                          {q.section === 'Reading and Writing' && (
                            <button
                              type="button"
                              className={`pane-mini-toggle ${lineReader ? 'active' : ''}`}
                              onClick={() => setLineReader((v) => !v)}
                              title="Toggle line reading guide"
                            >
                              Line Reader
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pane-scroll-body">
                        {leftTab === 'passage' && (
                          <div className="passage-content-card" onMouseUp={handleHighlightSelection}>
                            <div className="passage-badge-header">
                              <span className="source-label">
                                {q.questionType === 'spr' ? 'Grid-In (SPR)' : 'Multiple Choice'} · {q.domain}
                                {q.isChallenge ? ' · 1500+ Challenge' : ''}
                              </span>
                              <h3 className="passage-main-heading">{q.passageTitle}</h3>
                            </div>

                            {(highlights[q.id]?.length ?? 0) > 0 && (
                              <div className="rb-highlights-bar">
                                <span>
                                  {highlights[q.id].length} highlight{highlights[q.id].length === 1 ? '' : 's'} saved:
                                </span>
                                {highlights[q.id].map((snippet, hIdx) => (
                                  <mark key={hIdx} className="rb-saved-highlight">
                                    “{snippet.length > 42 ? snippet.slice(0, 40) + '…' : snippet}”
                                  </mark>
                                ))}
                                <button
                                  type="button"
                                  className="rb-highlight-clear"
                                  onClick={() => {
                                    setHighlights((prev) => {
                                      const next = { ...prev };
                                      delete next[q.id];
                                      saveHighlights(next);
                                      return next;
                                    });
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}

                            <div
                              className={`passage-body-text ${
                                lineReader && q.section === 'Reading and Writing' ? 'has-line-reader' : ''
                              }`}
                              onMouseMove={(e) => {
                                if (lineReader && q.section === 'Reading and Writing') {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setLineReaderPos(e.clientY - rect.top);
                                }
                              }}
                            >
                              {lineReader && q.section === 'Reading and Writing' && (
                                <div
                                  className="line-reader-guide"
                                  style={{ top: `${lineReaderPos}px` }}
                                />
                              )}
                              {!q.passage && (
                                <div className="question-prompt-card">
                                  <MathText text={q.prompt} />
                                  {q.svgDiagram && <SafeSvgDiagram svg={q.svgDiagram} alt={q.imageAlt || q.skill} />}
                                  {!q.svgDiagram && q.imageDataUrl && (
                                    <img className="imported-question-image" src={q.imageDataUrl} alt={q.imageAlt || 'Question diagram'} />
                                  )}
                                </div>
                              )}
                              {Boolean(q.passage) && q.svgDiagram && q.section !== 'Math' && (
                                <SafeSvgDiagram svg={q.svgDiagram} alt={q.imageAlt || 'Stimulus data diagram'} />
                              )}
                              {Boolean(q.passage) && !q.svgDiagram && q.imageDataUrl && q.section !== 'Math' && (
                                <img
                                  className="imported-question-image"
                                  src={q.imageDataUrl}
                                  alt={q.imageAlt || 'Stimulus data diagram'}
                                  style={{ marginBottom: '1.25rem' }}
                                />
                              )}
                              {q.passage && <MathText text={q.passage} />}
                            </div>
                          </div>
                        )}

                        {leftTab === 'reference' && (
                          <div className="reference-sheet-container">
                            <div className="ref-intro-banner">
                              <strong>Official Digital SAT Math Reference Sheet</strong>
                              <p>Formulas provided during the official exam.</p>
                            </div>

                            <div className="ref-formulas-grid">
                              <div className="ref-card">
                                <strong>Area of a Circle</strong>
                                <code>A = πr²</code>
                              </div>
                              <div className="ref-card">
                                <strong>Circumference of a Circle</strong>
                                <code>C = 2πr</code>
                              </div>
                              <div className="ref-card">
                                <strong>Area of a Rectangle</strong>
                                <code>A = ℓw</code>
                              </div>
                              <div className="ref-card">
                                <strong>Area of a Triangle</strong>
                                <code>A = ½bh</code>
                              </div>
                              <div className="ref-card highlight">
                                <strong>Pythagorean Theorem</strong>
                                <code>c² = a² + b²</code>
                              </div>
                              <div className="ref-card">
                                <strong>Special Right Triangles</strong>
                                <small>30°-60°-90°: x, x√3, 2x</small>
                                <small>45°-45°-90°: s, s, s√2</small>
                              </div>
                              <div className="ref-card">
                                <strong>Volume of Rectangular Prism</strong>
                                <code>V = ℓwh</code>
                              </div>
                              <div className="ref-card">
                                <strong>Volume of a Cylinder</strong>
                                <code>V = πr²h</code>
                              </div>
                              <div className="ref-card">
                                <strong>Volume of a Sphere</strong>
                                <code>V = ⁴⁄₃πr³</code>
                              </div>
                              <div className="ref-card">
                                <strong>Angles & Arc Degrees</strong>
                                <small>Circle degrees: 360° · Radians: 2π</small>
                                <small>Triangle angle sum: 180°</small>
                              </div>
                            </div>
                          </div>
                        )}

                        {leftTab === 'notes' && (
                          <div className="scratchpad-container">
                            <label className="scratchpad-label">
                              <span>Persistent Question Notes ({q.skill})</span>
                              <small>Saved permanently to this question and synced with Mistake Notebook</small>
                            </label>
                            <textarea
                              className="scratchpad-textarea"
                              placeholder="Write why the trap choice looked tempting, a theorem takeaway, or a pattern rule…"
                              value={questionNotes[q.id] || ''}
                              onChange={(e) => {
                                const next = saveQuestionNote(q.id, e.target.value);
                                setQuestionNotes(next);
                              }}
                            />
                          </div>
                        )}

                        {leftTab === 'scratchpad' && (
                          <div className="scratchpad-container">
                            <label className="scratchpad-label">
                              <span>Student Scratchpad & Calculation Notes</span>
                              <small>Notes are saved locally with this question</small>
                            </label>
                            <textarea
                              className="scratchpad-textarea"
                              placeholder="Jot down formulas, isolate variables, or eliminate incorrect premises..."
                              value={sessionNote}
                              onChange={(e) => setSessionNote(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </section>

                    {/* CENTER DIVIDER LINE */}
                    <div className="pane-separator-divider" role="separator" aria-label="Reading pane width" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={readingSplit} tabIndex={0} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();setReadingSplit(v=>e.key==='Home'?50:Math.max(30,Math.min(70,v+(e.key==='ArrowRight'?2:-2))))}}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const rect=e.currentTarget.parentElement!.getBoundingClientRect();setReadingSplit(Math.max(30,Math.min(70,(e.clientX-rect.left)/rect.width*100)))}}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}/>

                    {/* RIGHT PANEL: Question & Answer Workspace */}
                    <section className="practice-right-pane">
                      <div className="question-workspace-content">
                        {/* Question Top Header */}
                        <div className="question-headline-row">
                          <div className="question-counter-badge">
                            <span className="counter-pill">
                              QUESTION {modulePosition + 1} OF {moduleQuestions.length}
                            </span>
                            <div className="question-progress-dots">
                              {moduleQuestions.map((item, dotIdx) => (
                                <span
                                  key={item.id}
                                  className={`progress-dot ${dotIdx === modulePosition ? 'current' : ''} ${
                                    attempts.some((a) => a.id === item.id) ? 'completed' : ''
                                  } ${flagged.includes(item.id) ? 'flagged' : ''}`}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="question-action-toggles" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {q.questionType !== 'spr' && !submitted && (
                              <button
                                type="button"
                                className={`flag-question-btn ${predictMode ? 'flagged' : ''}`}
                                aria-pressed={predictMode}
                                title="Mask options until you predict your own answer (P)"
                                onClick={() => setPredictMode((v) => !v)}
                              >
                                <Eye size={14} />
                                <span>{predictMode ? 'Predicting' : 'Predict'}</span>
                              </button>
                            )}
                            <CollectionBookmarkButton
                              questionId={q.id}
                              collections={collections}
                              onToggle={handleToggleCollection}
                              onCreate={handleCreateCollection}
                            />
                            <button
                              type="button"
                              className={`flag-question-btn ${flagged.includes(q.id) ? 'flagged' : ''}`}
                              onClick={() =>
                                setFlagged((old) =>
                                  old.includes(q.id) ? old.filter((id) => id !== q.id) : [...old, q.id]
                                )
                              }
                            >
                              <Flag size={14} className={flagged.includes(q.id) ? 'fill-current' : ''} />
                              <span>{flagged.includes(q.id) ? 'Flagged' : 'Flag for review'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Question Prompt */}
                        <div className="question-prompt-card">
                          <h2>
                            {q.passage ? (
                              <MathText inline text={q.prompt} />
                            ) : q.questionType === 'spr' ? (
                              'Enter your numeric response:'
                            ) : (
                              'Select the correct answer choice:'
                            )}
                          </h2>
                          {Boolean(q.passage) && q.svgDiagram && q.section === 'Math' && (
                            <SafeSvgDiagram svg={q.svgDiagram} alt={q.imageAlt || 'Question diagram'} />
                          )}
                          {Boolean(q.passage) && !q.svgDiagram && q.imageDataUrl && q.section === 'Math' && (
                            <img className="imported-question-image" src={q.imageDataUrl} alt={q.imageAlt || 'Question diagram'} />
                          )}
                        </div>

                        {/* SPR Grid-In OR Predict Mask OR MCQ Options */}
                        {q.questionType === 'spr' ? (
                          <SprInput
                            value={sprResponse}
                            submitted={submitted}
                            isCorrect={currentQuestionCorrect}
                            acceptableAnswers={q.sprAnswers || []}
                            onChange={setSprResponse}
                            onSubmit={submit}
                          />
                        ) : predictMode && !predictRevealed && !submitted ? (
                          <div className="rb-predict-card">
                            <span className="eyebrow">REDBOOK PREDICT</span>
                            <strong>Write your prediction before looking at the choices</strong>
                            <input
                              type="text"
                              placeholder="e.g. Needs a contrast transition, or x ≈ 6…"
                              value={predictText}
                              onChange={(e) => setPredictText(e.target.value)}
                            />
                            <button
                              type="button"
                              className="submit-answer-btn"
                              onClick={() => setPredictRevealed(true)}
                            >
                              <span>Reveal answer choices</span>
                              <Eye size={15} />
                            </button>
                          </div>
                        ) : (
                          <div className="options-container">
                            {q.options.map((option, optIdx) => {
                              const isSelected = choice === optIdx;
                              const isEliminated = (eliminated[q.id] || []).includes(optIdx);

                              return (
                                <div
                                  key={option.letter}
                                  className={`answer-option-row ${isSelected ? 'selected' : ''} ${
                                    isEliminated ? 'eliminated' : ''
                                  } ${submitted ? 'submitted-locked' : ''}`}
                                  onClick={() => {
                                    if (!submitted) {
                                      setChoice(optIdx);
                                      if (isEliminated) {
                                        toggleEliminate(optIdx, { stopPropagation: () => {} } as any);
                                      }
                                    }
                                  }}
                                >
                                  <button className="option-select-area" type="button" aria-pressed={isSelected} disabled={submitted} onClick={e=>{e.stopPropagation();setChoice(optIdx);if(isEliminated)toggleEliminate(optIdx,e)}}>
                                    <span className="option-letter-circle">{option.letter}</span>
                                    <span className="option-text-span">
                                      <MathText inline text={option.text} />
                                    </span>
                                  </button>

                                  {!submitted && (
                                    <button
                                      type="button"
                                      className={`eliminate-trigger-btn ${isEliminated ? 'eliminated-active' : ''}`}
                                      onClick={(e) => toggleEliminate(optIdx, e)}
                                      title={isEliminated ? 'Restore choice' : 'Eliminate choice'}
                                    >
                                      <Minus size={14} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Action Bar (Check answer or Next) */}
                        <div className="question-action-bar">
                          {!submitted ? (
                            <button
                              className="submit-answer-btn"
                              disabled={!canSubmitCurrent}
                              onClick={submit}
                            >
                              <span>Check answer</span>
                              <Check size={16} />
                            </button>
                          ) : (
                            /* Diagnostic Feedback Card */
                            <div
                              className={`answer-result-card ${
                                currentQuestionCorrect ? 'is-correct' : 'is-incorrect'
                              }`}
                            >
                              <div className="result-header">
                                <div className="result-status-title">
                                  {currentQuestionCorrect ? (
                                    <>
                                      <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                                      <div>
                                        <strong>Correct — Well Done!</strong>
                                        <small>Great logical deduction</small>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle size={20} className="text-rose-500 shrink-0" />
                                      <div>
                                        <strong>Let’s Understand This Mistake</strong>
                                        <small>Added to your mistake notebook for scheduled return</small>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {!currentQuestionCorrect && (
                                  <span className="error-queue-badge">Saved for Review</span>
                                )}
                              </div>

                              <SolverFeedbackAddons
                                question={q}
                                studentSeconds={
                                  attempts.filter((a) => a.id === q.id).at(-1)?.seconds ?? elapsed
                                }
                                onOpenDesmos={(exprs) => {
                                  setCalcExpressions(exprs);
                                  setShowCalculator(true);
                                }}
                              />

                              {/* Error Root-Cause Tagging */}
                              {!currentQuestionCorrect && (() => {
                                let target: Attempt | undefined;
                                for (let k = attempts.length - 1; k >= 0; k -= 1) {
                                  if (attempts[k].id === q.id) {
                                    target = attempts[k];
                                    break;
                                  }
                                }
                                const selectedCause = normalizeSlipCause(target?.cause);
                                return (
                                  <div className="mistake-tagging-section">
                                    <span className="tagging-label">What caused this slip?</span>
                                    <div className="cause-pills-row">
                                      {SLIP_CAUSES.map((causeName) => {
                                        const isSelectedCause = selectedCause === causeName;
                                        return (
                                          <button
                                            key={causeName}
                                            type="button"
                                            aria-pressed={isSelectedCause}
                                            className={`cause-tag-btn ${
                                              isSelectedCause ? 'active' : ''
                                            }`}
                                            onClick={() => {
                                              if (target) update(target, { cause: causeName });
                                            }}
                                          >
                                            {causeName}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="result-footer-actions">
                                <button
                                  className="view-notebook-btn"
                                  onClick={() => setView('Mistakes')}
                                >
                                  Open Mistake Notebook →
                                </button>
                                <button
                                  className="next-question-btn"
                                  onClick={nextQuestion}
                                >
                                  <span>{modulePosition === moduleQuestions.length - 1 ? 'Review module' : 'Next question'}</span>
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* 3. Bottom Controls Bar */}
                  <footer className="practice-footer-bar">
                    <div className="footer-left-tools">
                      <button
                        className={`footer-btn ${showNote ? 'active' : ''}`}
                        onClick={() => {
                          setLeftTab('scratchpad');
                          setShowNote((v) => !v);
                        }}
                      >
                        <PenTool size={14} />
                        <span>Scratchpad</span>
                      </button>

                      <button
                        className={`footer-btn ${leftTab === 'notes' ? 'active' : ''}`}
                        onClick={() => setLeftTab((t) => (t === 'notes' ? 'passage' : 'notes'))}
                      >
                        <StickyNote size={14} />
                        <span>Notes</span>
                      </button>

                      <button
                        className="footer-btn"
                        title="Keyboard shortcuts (?)"
                        onClick={() => setShowShortcuts(true)}
                      >
                        <Keyboard size={14} />
                        <span>Shortcuts</span>
                      </button>

                      {q.section === 'Reading and Writing' && (
                        <button
                          className={`footer-btn ${lineReader ? 'active' : ''}`}
                          onClick={() => setLineReader((v) => !v)}
                        >
                          <BookmarkCheck size={14} />
                          <span>Line reader</span>
                        </button>
                      )}


                    </div>

                    <div className="footer-center">
                      <button
                        className="footer-navigator-btn"
                        aria-haspopup="dialog"
                        aria-expanded={showNavigator}
                        onClick={() => setShowNavigator((v) => !v)}
                      >
                        <span>Question {modulePosition + 1} of {moduleQuestions.length}</span>
                        <ChevronRight size={14} className="rotate-90 ml-1.5" />
                      </button>
                    </div>

                    <div className="footer-right-nav">
                      {modulePosition < moduleQuestions.length - 1 && <button className="footer-nav-btn" onClick={reviewModule}>Review module</button>}
                      <button
                        className="footer-nav-btn prev"
                        disabled={modulePosition <= 0}
                        onClick={() => navigateQuestion(questions.findIndex(item=>item.id===moduleQuestions[modulePosition-1]?.id))}
                      >
                        <ChevronLeft size={16} />
                        <span>Back</span>
                      </button>
                      <button
                        className="footer-nav-btn next primary"
                        onClick={nextQuestion}
                      >
                        <span>{modulePosition === moduleQuestions.length - 1 ? 'Review module' : 'Next'}</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </footer>

                  {/* 5. Formula Reference Sheet Modal */}
                  {showRefSheetModal && (
                    <div
                      className="navigator-backdrop"
                      onClick={() => setShowRefSheetModal(false)}
                    >
                      <div
                        className="reference-sheet-modal" role="dialog" aria-modal="true" aria-label="Math reference sheet"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="modal-top-bar">
                          <h3>SAT Math Reference Sheet</h3>
                          <button
                            className="close-modal-btn"
                            onClick={() => setShowRefSheetModal(false)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="modal-formulas-scroll">
                          <div className="ref-formulas-grid">
                            <div className="ref-card">
                              <strong>Area of a Circle</strong>
                              <code>A = πr²</code>
                            </div>
                            <div className="ref-card">
                              <strong>Circumference of a Circle</strong>
                              <code>C = 2πr</code>
                            </div>
                            <div className="ref-card">
                              <strong>Area of a Rectangle</strong>
                              <code>A = ℓw</code>
                            </div>
                            <div className="ref-card">
                              <strong>Area of a Triangle</strong>
                              <code>A = ½bh</code>
                            </div>
                            <div className="ref-card highlight">
                              <strong>Pythagorean Theorem</strong>
                              <code>c² = a² + b²</code>
                            </div>
                            <div className="ref-card">
                              <strong>Special Right Triangles</strong>
                              <small>30°-60°-90°: x, x√3, 2x</small>
                              <small>45°-45°-90°: s, s, s√2</small>
                            </div>
                            <div className="ref-card">
                              <strong>Volume of Rectangular Prism</strong>
                              <code>V = ℓwh</code>
                            </div>
                            <div className="ref-card">
                              <strong>Volume of a Cylinder</strong>
                              <code>V = πr²h</code>
                            </div>
                            <div className="ref-card">
                              <strong>Volume of a Sphere</strong>
                              <code>V = ⁴⁄₃πr³</code>
                            </div>
                            <div className="ref-card">
                              <strong>Circle & Triangle Angle Rules</strong>
                              <small>Circle degrees = 360° · Radians = 2π</small>
                              <small>Triangle angles sum to 180°</small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ============================================================== */}
          {/* MISTAKES & SAVED HUB VIEW */}
          {/* ============================================================== */}
          {view === 'Mistakes' && (
            <MistakesAndSavedHub
              questions={questions}
              attempts={attempts}
              collections={collections}
              questionNotes={questionNotes}
              domainFilter={domainFilter}
              domains={domains}
              onDomainChange={setDomainFilter}
              onUpdateAttempt={update}
              onPracticeQuestion={(i) => {
                if (i >= 0) start(i);
              }}
            />
          )}

          {/* ============================================================== */}
          {/* PLANNER VIEW */}
          {/* ============================================================== */}
          {view === 'Planner' && (
            <div style={{ display: 'grid', gap: '28px' }}>
              <AdaptivePlanner
                questions={questions}
                attempts={attempts}
                onStartTopic={(i) => start(i)}
              />
              <StudyDashboard plannerOnly attempts={attempts} questions={questions} user={user} due={due.length} onPractice={id=>{const i=questions.findIndex(item=>item.id===id);if(i>=0)start(i);else switchView('Practice')}} onProgress={()=>switchView('Progress')} onMistakes={()=>switchView('Mistakes')} />
            </div>
          )}

          {view === 'Settings' && <><h1>Settings</h1><p>Make this space yours.</p><div className="rb-settings-grid">
            <section className="card settings-panel"><h2>Appearance</h2><label><span>Appearance<small>Use a light, dark, or device-matched theme.</small></span><select value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><label><span>Accent color</span><select value={accent} onChange={e=>setAccent(e.target.value)}><option value="amber">Claude Amber</option><option value="azure">Azure Blue</option><option value="silver">Silver Grey</option></select></label><label><span>Hide sidebar<small>Open it again from the toolbar.</small></span><input type="checkbox" checked={collapsed} onChange={e=>setCollapsed(e.target.checked)}/></label><label><span>Reduce motion</span><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/></label><label><span>Increase contrast</span><input type="checkbox" checked={highContrast} onChange={e=>setHighContrast(e.target.checked)}/></label><label><span>Reduce transparency<small>Use solid surfaces in place of glass.</small></span><input type="checkbox" checked={solidGlass} onChange={e=>setSolidGlass(e.target.checked)}/></label><label><span>Study sound effects<small>Subtle chime when checking answers (muted by default).</small></span><input type="checkbox" checked={habits.soundEnabled} onChange={()=>setHabits(prev=>{const n={...prev,soundEnabled:!prev.soundEnabled};saveHabits(n);return n})}/></label></section>
            <section className="card settings-panel"><h2>Practice</h2><label><span>Reading size</span><select value={readingSize} onChange={e=>setReadingSize(e.target.value)}><option value="standard">Standard</option><option value="large">Large</option></select></label><label><span>Focused practice<small>Hide secondary tools during a session.</small></span><input type="checkbox" checked={focusPractice} onChange={e=>setFocusPractice(e.target.checked)}/></label><label><span>Reading pane width<small>Drag the divider during practice, or use its arrow keys.</small></span><div className="rb-range"><input aria-label="Reading pane width" type="range" min="30" max="70" value={readingSplit} onChange={e=>setReadingSplit(Number(e.target.value))}/><small>{readingSplit.toFixed(0)}%</small></div></label><div className="rb-group-body"><Info size={18}/><p>Your answers save in this browser. A saved explanation and ordinary grading never use AI credits.</p></div></section>
            <section className="card settings-panel"><h2>Plan, Sparks &amp; Guardian Portal</h2><div className="rb-group-body"><p>Current tier: <strong style={{textTransform:'uppercase'}}>{habits.sparksTier}</strong> · <strong>{habits.sparksTier==='pro'?'Unlimited':habits.sparksBalance}</strong> weekly AI Sparks</p><div className="rb-actions"><button className="primary" onClick={()=>setPricingOpen(true)}><Zap size={16}/> Upgrade Plus / Pro</button><a className="rb-link-button" href={`/guardians?student=${encodeURIComponent(user?.name||'Student')}&target=${user?.targetScore||1400}`}><Shield size={16}/> Guardian Portal</a></div></div></section>
            <section className="card settings-panel"><h2>Your profile &amp; Cloud Sync</h2><div className="rb-group-body"><div className="rb-profile"><span className="rb-avatar">{user?.name?.[0]?.toUpperCase()||'S'}</span><span><strong>{user?.name||'Student'}</strong><small>{user?.isCloud||user?.uid?`Cloud synced (${user.email})`:'Local study profile'}</small></span></div><p>{user?.isCloud||user?.uid?'Your progress, notes, and study plan automatically sync to your cloud account across devices. Guest attempts merge cleanly on sign-in.':'Sign in with Google or an email code so your practice history and study plan are backed up across devices.'}</p><div className="rb-actions">{!(user?.isCloud||user?.uid)&&isCloudConfigured&&<button className="primary" onClick={async()=>{try{await signInWithGoogle('/study');}catch{window.location.href='/login';}}}>Sign in with Google</button>}<a className="rb-link-button" href="/login"><UserRound size={17}/>{user?.isCloud||user?.uid?'Switch account':'Sign in / Sign up'}</a>{user&&<button onClick={async()=>{await signOutCloud();setUser(null)}}>Sign out</button>}</div></div></section>
            <section className="card settings-panel"><h2>Your study data</h2><div className="rb-group-body"><p>{attempts.length} saved attempts, along with your notes and review dates. Stored on this device.</p><button className="primary" onClick={exportStudy}><Download size={17}/>Export study backup</button><a href="/privacy">How your data is stored</a></div></section>
          </div></>}

          {/* ============================================================== */}
          {/* PROGRESS VIEW */}
          {/* ============================================================== */}
          {view === 'Progress' && (
            <>
              <span className="eyebrow">YOUR NEXT STEP</span><h1>Progress</h1>
              <section className="card">
                <h2>
                  {attempts.length === 0
                    ? 'No questions attempted yet · 0% accuracy'
                    : `${attempts.length} ${attempts.length === 1 ? 'question' : 'questions'} attempted · ${accuracy}% accuracy`}
                </h2>
                <p>
                  {attempts.length === 0
                    ? 'Complete your first practice module to see accuracy and topic mastery insights.'
                    : attempts.length < 10
                    ? 'Not enough practice yet for reliable trends. Keep practising across skills.'
                    : 'These figures describe this sample practice, not a predicted SAT score.'}
                </p>
              </section>
              <ActivityHeatmapAnalytics questions={questions} attempts={attempts} />
              {(() => {
                const skillMap = questions.reduce((map, q) => {
                  const key = formatSkillTitle(q.skill) || 'Unclassified Skill';
                  const group = map.get(key) || {
                    skill: key,
                    domain: q.domain,
                    section: q.section,
                    items: [] as PracticeQuestion[],
                  };
                  group.items.push(q);
                  map.set(key, group);
                  return map;
                }, new Map<string, { skill: string; domain: string; section: string; items: PracticeQuestion[] }>());

                const groupsWithStats = Array.from(skillMap.values()).map((group) => {
                  const itemById = new Map(group.items.map((item) => [item.id, item]));
                  const rows = attempts.filter((a) => itemById.has(a.id));
                  const correctCount = rows.filter((a) => isAttemptCorrect(a, itemById.get(a.id))).length;
                  const solvedUnique = new Set(rows.map((a) => a.id)).size;
                  const avgSeconds = rows.length ? Math.round(rows.reduce((n, a) => n + a.seconds, 0) / rows.length) : 0;
                  const skillAccuracy = rows.length ? Math.round((correctCount / rows.length) * 100) : 0;
                  const firstQuestionIndex = questions.findIndex((q) => itemById.has(q.id));
                  const lastAttemptTime = rows.length ? Math.max(...rows.map((a) => new Date(a.date).getTime() || 0)) : 0;

                  return {
                    ...group,
                    rows,
                    correctCount,
                    solvedUnique,
                    avgSeconds,
                    skillAccuracy,
                    firstQuestionIndex,
                    lastAttemptTime,
                    hasStarted: rows.length > 0,
                  };
                });

                const practiced = groupsWithStats
                  .filter((g) => g.hasStarted)
                  .sort((a, b) => b.lastAttemptTime - a.lastAttemptTime || b.rows.length - a.rows.length);

                const unstarted = groupsWithStats.filter((g) => !g.hasStarted);

                return (
                  <>
                    {practiced.length > 0 && (
                      <div className="progress-section-group">
                        <div className="progress-section-divider">
                          <h2>Practiced skills ({practiced.length})</h2>
                          <span>Prioritized by recent activity</span>
                        </div>
                        {practiced.map((group) => (
                          <section className="card progress-skill-card is-practiced" key={group.skill}>
                            <div className="progress-skill-header">
                              <div>
                                <span className="eyebrow">{group.section} · {group.domain}</span>
                                <h2>{group.skill}</h2>
                              </div>
                              <span className="progress-accuracy-badge">{group.skillAccuracy}% accuracy</span>
                            </div>
                            <progress aria-label={group.skill + ' progress'} max={group.items.length} value={group.solvedUnique} />
                            <div className="progress-skill-stats">
                              <p>
                                {group.solvedUnique} of {group.items.length} {group.items.length === 1 ? 'question' : 'questions'} solved ·{' '}
                                {group.rows.length} {group.rows.length === 1 ? 'attempt' : 'attempts'} · {group.correctCount} correct · {group.avgSeconds}s average
                              </p>
                              {group.firstQuestionIndex >= 0 && (
                                <button
                                  className="progress-quick-practice-btn"
                                  onClick={() => start(group.firstQuestionIndex)}
                                >
                                  Practise again <ArrowUpRight size={14} />
                                </button>
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}

                    {unstarted.length > 0 && (
                      <div className="progress-section-group">
                        <div className="progress-section-divider">
                          <h2>Not started ({unstarted.length})</h2>
                          <span>Ready when you want to explore</span>
                        </div>
                        {unstarted.map((group) => (
                          <section className="card progress-skill-card is-unstarted" key={group.skill}>
                            <div className="progress-skill-header">
                              <div>
                                <span className="eyebrow">{group.section} · {group.domain}</span>
                                <h2>{group.skill}</h2>
                              </div>
                              <span className="progress-status-pill not-started">Not started</span>
                            </div>
                            <div className="progress-skill-stats">
                              <p>
                                {group.items.length} {group.items.length === 1 ? 'question' : 'questions'} available · Untimed practice
                              </p>
                              {group.firstQuestionIndex >= 0 && (
                                <button
                                  className="progress-quick-practice-btn primary"
                                  onClick={() => start(group.firstQuestionIndex)}
                                >
                                  Start <ArrowUpRight size={14} />
                                </button>
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </>
      )}

      </div>
      {/* ============================================================== */}
      {/* QUESTION NAVIGATOR MODAL */}
      {/* ============================================================== */}
      {showNavigator && opened && view === 'Practice' && (
        <div className="navigator-backdrop" onClick={() => setShowNavigator(false)}>
          <section
            className="question-navigator"
            role="dialog"
            aria-modal="true"
            aria-label="Question navigator"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowNavigator(false);
            }}
          >
            <div className="navigator-heading">
              <div>
                <h2>Question Navigator</h2>
                <p>Select any question to jump directly to it.</p>
              </div>
              <button
                autoFocus
                aria-label="Close question navigator"
                onClick={() => setShowNavigator(false)}
              >
                ✕
              </button>
            </div>
            <div className="navigator-grid">
              {moduleQuestions.map((item, position) => {
                const i = questions.findIndex((other) => other.id === item.id);
                const draftRow = i === index ? { choice, sprResponse } : questionDrafts.current[i];
                const answered = isDraftAnswered(item, draftRow);
                return (
                  <button
                    key={item.id}
                    aria-current={i === index ? 'step' : undefined}
                    className={(i === index ? 'current ' : '') + (answered ? 'answered ' : '')}
                    onClick={() => {
                      if (i !== index) navigateQuestion(i);
                      else setShowNavigator(false);
                    }}
                  >
                    <strong>{position + 1}</strong>
                    <span>
                      {flagged.includes(item.id)
                        ? '⚑ Flagged'
                        : answered
                        ? 'Answered'
                        : 'Not answered'}
                    </span>
                  </button>
                );
              })}
            </div>
            <small>
              Your submitted attempts and unfinished drafts are preserved in browser storage.
            </small>
            <div className="module-actions"><button className="primary" onClick={reviewModule}>Review / finish module</button></div>
          </section>
        </div>
      )}

      {moduleStage && opened && view === 'Practice' && (
        <div className="navigator-backdrop" onClick={closeModuleReview}>
          <section className="question-navigator module-review" role="dialog" aria-modal="true" aria-label={moduleStage === 'finished' ? 'Module results' : 'Module review'} onClick={event => event.stopPropagation()}>
            <div className="navigator-heading">
              <div><h2 ref={moduleHeading} tabIndex={-1}>{moduleStage === 'finished' ? 'Module complete' : 'Review your module'}</h2>
                <p>{moduleStage === 'finished' ? `${moduleCorrect} correct · ${moduleQuestions.length - moduleAnswered} unanswered · ${moduleQuestions.length} questions` : `${moduleAnswered} of ${moduleQuestions.length} answered · ${flagged.length} flagged for review`}</p>
              </div>
              <button aria-label="Close module review" onClick={closeModuleReview}>✕</button>
            </div>
            {moduleStage === 'review' ? <>
              <p>Check any question before finishing. Unanswered questions will be recorded as unanswered.</p>
              <div className="navigator-grid">{moduleAnswers.map(({question, draft}, i) => {
                const answered = isDraftAnswered(question, draft);
                return <button key={question.id} onClick={() => navigateQuestion(questions.findIndex(other=>other.id===question.id))} className={answered ? 'answered' : ''}>
                  <strong>{i + 1}</strong><span>{answered ? 'Answered' : 'Unanswered'}{flagged.includes(question.id) ? ' · ⚑ Flagged' : ''}</span>
                </button>;
              })}</div>
              <div className="module-actions"><button onClick={() => setModuleStage('')}>Continue answering</button><button className="primary" onClick={finishModule}>Finish module</button></div>
            </> : <>
              <p>Your results are saved on this device. Review the explanations below or return to your library.</p>
              <div className="module-results">{moduleAnswers.map(({question, draft}, i) => {
                const answered = isDraftAnswered(question, draft);
                const ok = answered && isDraftCorrect(question, draft);
                const yourAnswerText = !answered
                  ? 'No answer'
                  : question.questionType === 'spr'
                  ? draft?.sprResponse || 'No answer'
                  : question.options[draft!.choice!]?.text || 'No answer';
                const correctText =
                  question.questionType === 'spr'
                    ? (question.sprAnswers || []).join(' or ')
                    : question.options[question.answer]?.text || '';
                return <details key={question.id}>
                  <summary>Question {i + 1} · {!answered ? 'Unanswered' : ok ? 'Correct' : 'Incorrect'}</summary>
                  <p>{question.prompt}</p>
                  <p>Your answer: {yourAnswerText}</p>
                  <p>Correct answer: {correctText}</p><p>{question.explanation}</p>
                </details>;
              })}</div>
              <div className="module-actions"><button className="primary" onClick={() => {setModuleStage('');setOpened(false);}}>Return to library</button></div>
            </>}
          </section>
        </div>
      )}

      <GraphCalculator
        open={showCalculator && ((opened && view === 'Practice' && q?.section === 'Math') || view === 'Mock tests')}
        expressions={calcExpressions}
        onClose={() => setShowCalculator(false)}
      />

      <SolverShortcutsModal open={showShortcuts && isPlayerActive} onClose={() => setShowShortcuts(false)} />

      <CommandPalette
        open={cmdOpen}
        questions={questions}
        navItems={navItems}
        onClose={() => setCmdOpen(false)}
        onNavigateTab={(tabKey) => {
          setRushOpen(false);
          switchView(tabKey);
        }}
        onStartQuestion={(idx) => {
          setRushOpen(false);
          start(idx);
        }}
      />

      <PricingModal
        open={pricingOpen}
        currentTier={habits.sparksTier}
        userEmail={user?.email}
        onClose={() => setPricingOpen(false)}
      />

      <footer className="rb-app-footer">
        <p>RedBookPrep · Independent SAT preparation. Sample content is not official test material.</p>
      </footer>
    </main>
  );
}
