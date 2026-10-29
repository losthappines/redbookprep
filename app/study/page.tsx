'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import './redbook.css';
import {GraphCalculator} from '@/components/study/graph-calculator';
import {useRedbookSidebar} from '@/components/study/use-redbook-sidebar';
import {useStudyDialog} from '@/components/study/use-study-dialog';
import {PanelLeft, Search, Play, Download, UserRound, ArrowUpRight, Sun, Moon, Eye, Menu, SlidersHorizontal} from 'lucide-react';
import {parseBbplus, type PracticeQuestion} from '@/components/study/bbplus';
import {StudyDashboard} from '@/components/study/study-dashboard';
import {getFirebaseAuth,onAuthStateChanged,pullCloudProgress,pushCloudProgress,signOut,GoogleAuthProvider,signInWithPopup,isFirebaseConfigured} from '@/lib/firebase';
import {StudyBubbleBackground} from '@/components/study/study-bubble-background';
import {FloatingDock} from '@/components/ui/floating-dock';
import {AnimatePresence} from 'motion/react';
import {Vocabulary} from '@/components/study/vocabulary';
import {QuestionBank} from '@/components/study/question-bank';
import {PracticeFolders} from '@/components/study/practice-folders';
import {RedCoachChat} from '@/components/study/redcoach-chat';
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

const navItems = [
  { key: 'Home', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'Ask redCoach', label: 'Ask redCoach', icon: Sparkles },
  { key: 'Practice', label: 'Practice', icon: BookOpen },
  { key: 'Question bank', label: 'Question bank', icon: FileText },
  { key: 'Vocabulary', label: 'Vocabulary', icon: BookOpen },
  { key: 'Mistakes', label: 'Mistakes', icon: AlertCircle },
  { key: 'Planner', label: 'Planner', icon: Calendar },
  { key: 'Progress', label: 'Progress', icon: TrendingUp },
  { key: 'Settings', label: 'Settings', icon: SettingsIcon }
] as const;

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

const sampleQuestions: PracticeQuestion[] = [
  {
    id: 'transitions',
    skill: 'Transitions',
    section: 'Reading and Writing',
    domain: 'Expression of Ideas',
    focus: 'Identify a logical contrast between statements',
    source: 'Skills Insight · Table 8 · p. 19',
    passageTitle: 'Composite Materials in Aerospace Engineering',
    passage: `During field trials conducted under sub-zero conditions in northern Alberta, researchers monitored the structural resilience of a newly synthesized titanium-graphene alloy. Because initial computational simulations had predicted stress fractures under cyclic thermal loads, the design team expected the prototype to fail under peak strain.\n\n[ _____ ], the revised molecular lattice sustained every mechanical shock test without detectable micro-fissures, demonstrating superior tensile elasticity across fluctuating temperatures.`,
    prompt: 'Which choice completes the text with the most logical transition?',
    options: [
      { text: 'Nevertheless', letter: 'A' },
      { text: 'For example', letter: 'B' },
      { text: 'Similarly', letter: 'C' },
      { text: 'Consequently', letter: 'D' }
    ],
    answer: 0,
    explanation:
      '"Nevertheless" signals the necessary contrast between the team\'s expectation of simulated failure and the prototype\'s actual mechanical resilience.'
  },
  {
    id: 'linear',
    skill: 'Linear Equations in One Variable',
    section: 'Math',
    domain: 'Algebra',
    focus: 'Solve a linear equation in one variable',
    source: 'Skills Insight · Table 11 · p. 29',
    passageTitle: 'Courier Pricing Model & Route Formulation',
    passage: `A regional logistics drone service calculates the total delivery charge in dollars using the linear function:\n\nC(x) = 3x + 7\n\nwhere C represents the total invoice cost in dollars, 3 is the rate charged per mile, and 7 represents a fixed dispatch fee. A customer placing an expedited order was charged a total of $22 for their delivery.`,
    prompt: 'If 3x + 7 = 22, what is the delivery distance x in miles?',
    options: [
      { text: '3', letter: 'A' },
      { text: '5', letter: 'B' },
      { text: '7', letter: 'C' },
      { text: '15', letter: 'D' }
    ],
    answer: 1,
    explanation:
      'Step 1: Subtract the fixed fee of 7 from both sides: 3x = 22 - 7 = 15.\nStep 2: Divide both sides by 3: x = 15 / 3 = 5 miles.'
  },
  {
    id: 'evidence',
    skill: 'Reading Evidence',
    section: 'Reading and Writing',
    domain: 'Information and Ideas',
    focus: 'Identify evidence supporting an inference',
    source: 'Skills Insight · Reading Evidence · Table 5',
    passageTitle: 'Urban Planning and Transit-Oriented Development',
    passage: `In an effort to revitalize municipal engagement, the town council authorized the construction of a public reading library directly adjacent to the western platform of the regional railway station.\n\nAccording to post-occupancy commuter surveys, the facility\'s central location made it exceptionally convenient for suburban residents to visit and borrow materials on their evening return journeys, precipitating a 42% surge in weekly circulation.`,
    prompt: 'Which statement is best supported by the passage?',
    options: [
      { text: 'The library’s location was convenient for residents and commuters.', letter: 'A' },
      { text: 'The library replaced the existing railway station building.', letter: 'B' },
      { text: 'All residents of the town commuted exclusively by train.', letter: 'C' },
      { text: 'The town had no books prior to the library opening.', letter: 'D' }
    ],
    answer: 0,
    explanation:
      'The passage directly confirms that the facility\'s location adjacent to the railway station made visits easy and convenient for residents returning home.'
  }
];

type Attempt = {
  id: string;
  choice: number;
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
  const [activeModule,setActiveModule] = useState<string | null>(null);
  const moduleQuestions = activeModule ? questions.filter(q=>q.moduleId===activeModule) : sampleQuestions;
  const libraryQuestions = questions.filter((q,i)=>!q.moduleId||questions.findIndex(item=>item.moduleId===q.moduleId)===i);
  async function importMaterial(file:File) {
    if (!file.name.toLowerCase().endsWith('.bbplus')) throw Error('Choose a .bbplus file.');
    if (file.size > 5*1024*1024) throw Error('This file exceeds the 5 MB import limit.');
    const content=await file.text();
    let raw:unknown;
    try{raw=JSON.parse(content.replace(/^\uFEFF/,''));}catch{throw Error('This .bbplus file does not contain valid JSON.');}
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const imported=parseBbplus(raw,hash);
    const records=JSON.parse(localStorage.getItem('redbookprep-imports')||'[]');
    if (!Array.isArray(records)) throw Error('Saved imports could not be read.');
    if (!records.some((r:{key:string})=>r.key===hash)) {
      try{localStorage.setItem('redbookprep-imports',JSON.stringify([...records,{key:hash,pack:raw}]))}catch{throw Error('Not enough browser storage to save this material.');}
    }
    setQuestions(old=>[...old,...imported.filter(q=>!old.some(item=>item.id===q.id))]);
    return imported.filter((q,i)=>imported.findIndex(item=>item.moduleId===q.moduleId)===i).map(q=>({...q,skill:`${q.materialTitle} · ${q.moduleTitle}`}));
  }

  const shellRef=useRef<HTMLElement>(null);
  const openSidebarRef=useRef<HTMLButtonElement>(null);
  const closeSidebarRef=useRef<HTMLButtonElement>(null);
  const [mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
  const [smallViewport,setSmallViewport]=useState(false); const [portraitDock,setPortraitDock]=useState(false); useEffect(()=>{const mqPortrait=matchMedia('(orientation: portrait), (max-aspect-ratio: 1/1), (max-width: 900px)');const sync=()=>setPortraitDock(mqPortrait.matches);sync();mqPortrait.addEventListener('change',sync);window.addEventListener('resize',sync);return()=>{mqPortrait.removeEventListener('change',sync);window.removeEventListener('resize',sync)}},[]);
  useEffect(()=>{const media=matchMedia('(max-width:720px)');const sync=()=>setSmallViewport(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);
  const [solidGlass,setSolidGlass]=useState(false);
  const [highContrast,setHighContrast]=useState(false);
  const [accent,setAccent]=useState('amber');
  const [focusPractice,setFocusPractice]=useState(false);
  const [readingSplit,setReadingSplit]=useState(50);

  const questionDrafts = useRef<
    Record<number, { choice: number | null; submitted: boolean; started: number; note: string }>
  >({});
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
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(Date.now());
  const [storageError, setStorageError] = useState('');

  // Practice Experience State:
  const [leftTab, setLeftTab] = useState<'passage' | 'reference' | 'scratchpad'>('passage');
  const [eliminated, setEliminated] = useState<Record<string, number[]>>({});
  const [showCalculator, setShowCalculator] = useState(false);
  const [showRefSheetModal, setShowRefSheetModal] = useState(false);

  const q = questions[index];
  const today = new Date().toLocaleDateString('en-CA');

  // Auto switch left tab based on section
  useEffect(() => {
    if (q.section === 'Math') {
      // In math, if student opens question, default to passage or reference
      setLeftTab('passage');
    } else {
      setLeftTab('passage');
    }
  }, [index, q.section]);

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
    try{localStorage.setItem('redbookprep-settings', JSON.stringify({ collapsed, theme, readingSize, reduced,solidGlass,highContrast,accent,focusPractice,readingSplit }));void pushCloudProgress();}catch{setStorageError('Your settings could not be saved.');}
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.reading = readingSize;
      document.documentElement.dataset.motion = reduced ? 'reduced' : 'normal';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [collapsed, theme, readingSize, reduced,solidGlass,highContrast,accent,focusPractice,readingSplit,prefsReady]);

  useRedbookSidebar(shellRef,portraitDock||smallViewport?!mobileSidebarOpen:collapsed,reduced,prefsReady);
  const closeStudyDialog=useCallback(()=>{setShowNavigator(false);setShowRefSheetModal(false);setMobileSidebarOpen(false);setModuleStage('');if(moduleFinished.current)setOpened(false)},[]);
  useStudyDialog(showNavigator||showRefSheetModal||mobileSidebarOpen||Boolean(moduleStage),closeStudyDialog);
  const switchView=(next:string)=>{setView(next);setMobileSidebarOpen(false);if(next==='Practice')setOpened(false);window.scrollTo({top:0,behavior:'instant'})};
  const toggleSidebar=()=>{if(portraitDock||matchMedia('(max-width:720px)').matches){setMobileSidebarOpen(v=>!v)}else{setCollapsed(v=>!v);requestAnimationFrame(()=>collapsed?closeSidebarRef.current?.focus():openSidebarRef.current?.focus())}};
  const exportStudy=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,attempts},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='redbookprep-study-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  useEffect(()=>{if(ready){const params=new URLSearchParams({tab:view==='Home'?'dashboard':view.toLowerCase().replaceAll(' ','-')});if(view==='Practice'&&opened)params.set('solve','true');window.history.replaceState(null,'','/study?'+params.toString())}},[view,opened,ready]);

  // Initial load
  useEffect(() => {
    let questions=sampleQuestions;
    try {
      const records=JSON.parse(localStorage.getItem('redbookprep-imports')||'[]');
      if(!Array.isArray(records))throw Error();
      questions=[...sampleQuestions,...records.flatMap((r:{pack:unknown;key:string})=>parseBbplus(r.pack,r.key))];
      setQuestions(questions); void (async () => { try { const saved = JSON.parse(localStorage.getItem('redbookprep-imports') || '[]'); if (Array.isArray(saved) && saved.some((r: any) => String(r?.pack?.title || '').startsWith('Mathbook 3.0'))) { localStorage.setItem('redbookprep-imports', JSON.stringify(saved.filter((r: any) => !String(r?.pack?.title || '').startsWith('Mathbook 3.0')))); } } catch {} const builtInPacks = [{ url: '/packs/mathbook-3/algebra.bbplus?v=2', key: 'mathbook3-algebra' }, { url: '/packs/mathbook-3/advanced-math.bbplus?v=2', key: 'mathbook3-advanced-math' }, { url: '/packs/mathbook-3/problem-solving.bbplus?v=2', key: 'mathbook3-problem-solving' }, { url: '/packs/mathbook-3/geometry-trigonometry.bbplus?v=2', key: 'mathbook3-geometry-trigonometry' }]; try { const fetched = await Promise.all(builtInPacks.map(async ({ url, key }) => { const res = await fetch(url); if (!res.ok) return []; const raw = await res.json(); return parseBbplus(raw, key); })); const builtInQuestions = fetched.flat(); if (builtInQuestions.length) { setQuestions((old) => [...old.filter((q) => !String(q.materialTitle || '').startsWith('Mathbook 3.0')), ...builtInQuestions]); } } catch {} })();
    } catch {setStorageError('Saved imported materials could not be loaded.');}

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
                (questions.some((q) => q.id === a.id) || (typeof a.id === 'string' && a.id.startsWith('bbplus-mathbook3-'))) &&
                Number.isInteger(a.choice) &&
                a.choice >= 0 &&
                a.choice < 4
            )
            .map((a) => ({
              ...a,
              note: typeof a.note === 'string' ? a.note : '',
              cause: typeof a.cause === 'string' ? a.cause : '',
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
        } else if (t === 'practice') {
          setView('Practice');
          if (params.get('solve') === 'true') {
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
    setReady(true); const auth = getFirebaseAuth(); if (auth) { const unsubscribe = onAuthStateChanged(auth, async (fbUser) => { if (!fbUser) return; await pullCloudProgress(fbUser); try { const u = JSON.parse(localStorage.getItem('redbookprep-user') || 'null'); if (u) setUser({ ...u, uid: fbUser.uid, isCloud: true }); else { const profile = { uid: fbUser.uid, name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student', email: fbUser.email || '', targetScore: 1400, avatar: fbUser.photoURL || undefined, isCloud: true }; localStorage.setItem('redbookprep-user', JSON.stringify(profile)); setUser(profile); } const syncedAttempts = JSON.parse(localStorage.getItem('redbookprep-demo') || '[]'); if (Array.isArray(syncedAttempts)) setAttempts(syncedAttempts); const p = JSON.parse(localStorage.getItem('redbookprep-settings') || '{}'); if (p && typeof p === 'object') { if (['light', 'dark', 'system'].includes(p.theme)) setTheme(p.theme); if (p.readingSize === 'large' || p.readingSize === 'standard') setReadingSize(p.readingSize); if (typeof p.reduced === 'boolean') setReduced(p.reduced); if (typeof p.solidGlass === 'boolean') setSolidGlass(p.solidGlass); if (typeof p.highContrast === 'boolean') setHighContrast(p.highContrast); if (['amber', 'azure', 'silver'].includes(p.accent)) setAccent(p.accent); } } catch {} void pushCloudProgress(); }); return () => unsubscribe(); }
  }, []);

  // Save attempts
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem('redbookprep-demo', JSON.stringify(attempts));
        void pushCloudProgress({ attempts });
      } catch {
        setStorageError('Your browser could not save progress.');
      }
    }
  }, [attempts, ready]);

  // Save draft
  useEffect(() => {
    if (ready && opened) {
      try {
        questionDrafts.current[index] = {choice, submitted, started, note: sessionNote};
        localStorage.setItem(
          'redbookprep-draft',
          JSON.stringify({ index, choice, started, submitted, note: sessionNote, questions: questionDrafts.current, flagged, finished: moduleFinished.current })
        );
      } catch {
        setStorageError('Your unfinished answer could not be saved.');
      }
    }
  }, [ready, opened, index, choice, started, submitted, sessionNote, flagged, moduleStage]);

  const mistakes = attempts.filter((a) => a.choice !== questions.find((q) => q.id === a.id)?.answer);
  const accuracy = attempts.length
    ? Math.round((100 * (attempts.length - mistakes.length)) / attempts.length)
    : 0;

  const reviewQueue = questions.flatMap((q) => {
    const rows = attempts.filter((a) => a.id === q.id);
    const last = rows[rows.length - 1];
    return last && last.choice !== q.answer ? [last] : [];
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
    questionDrafts.current[index] = { choice, submitted, started, note: sessionNote };
    const draft = questionDrafts.current[i];
    setShowNavigator(false);
    setIndex(i);
    setChoice(draft?.choice ?? null);
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
    questionDrafts.current[index] = {choice, submitted, started, note: sessionNote};
    setShowNavigator(false);
    setShowCalculator(false);
    setModuleStage(moduleFinished.current ? 'finished' : 'review');
  }

  function nextQuestion() {
    const position=moduleQuestions.findIndex(item=>item.id===q.id);
    if (position === moduleQuestions.length - 1) reviewModule();
    else navigateQuestion(questions.findIndex(item=>item.id===moduleQuestions[position+1]?.id));
  }

  const modulePosition=moduleQuestions.findIndex(item=>item.id===q.id);
  const moduleAnswers = moduleQuestions.map((item) => {const i=questions.findIndex(q=>q.id===item.id);return ({
    question: item,
    draft: i === index ? {choice, submitted, started, note: sessionNote} : questionDrafts.current[i],
  })});
  const moduleAnswered = moduleAnswers.filter(item => item.draft?.choice != null).length;
  const moduleCorrect = moduleAnswers.filter(item => item.draft?.choice === item.question.answer).length;

  function finishModule() {
    if (moduleFinished.current) return;
    const now = Date.now();
    questionDrafts.current[index] = {choice, submitted, started, note: sessionNote};
    const pending: Attempt[] = [];
    moduleQuestions.forEach((item) => {
      const i=questions.findIndex(q=>q.id===item.id);
      const draft = questionDrafts.current[i];
      if (!draft || draft.choice === null || draft.submitted) return;
      pending.push({id: item.id, choice: draft.choice, seconds: Math.max(0, Math.round((now - draft.started) / 1000)), date: new Date(now).toISOString(), review: new Date(now + 86400000).toISOString().slice(0, 10), note: draft.note, cause: ''});
      questionDrafts.current[i] = {...draft, submitted: true};
    });
    moduleFinished.current = true;
    if (pending.length) setAttempts(old => [...old, ...pending]);
    if (choice !== null) setSubmitted(true);
    setModuleStage('finished');
  }

  function submit() {
    if (choice === null || submitted || moduleFinished.current) return;
    setAttempts((a) => [
      ...a,
      {
        id: q.id,
        choice,
        seconds: Math.round((Date.now() - started) / 1000),
        date: new Date().toISOString(),
        review: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        note: sessionNote,
        cause: ''
      }
    ]);
    setSubmitted(true);
  }

  function update(a: Attempt, patch: Partial<Attempt>) {
    setAttempts((old) => old.map((item) => (item === a ? { ...item, ...patch } : item)));
  }

  // Toggle Elimination for an answer choice
  function toggleEliminate(optIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    const currentList = eliminated[q.id] || [];
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
        (opened && view === 'Practice' ? 'player-view' : 'dashboard-view')
      }
    >
      {!(opened && view === 'Practice') && <StudyBubbleBackground reduced={reduced} highContrast={highContrast}/>}
      <header className="topbar">
        <span aria-hidden="true" style={{position:'absolute',inset:'0 0 -48px',zIndex:0,pointerEvents:'none',background:'transparent',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',maskImage:'linear-gradient(to bottom,black 0%,black 15%,#000c 40%,#0006 65%,#0002 85%,transparent 100%)',WebkitMaskImage:'linear-gradient(to bottom,black 0%,black 15%,#000c 40%,#0006 65%,#0002 85%,transparent 100%)'}} />
        <div className="rb-toolbar-start"><button ref={openSidebarRef} className="rb-icon-button rb-sidebar-open" aria-label="Open sidebar" aria-expanded={mobileSidebarOpen||!collapsed} onClick={toggleSidebar}><PanelLeft size={19}/></button><h2>{view==='Home'?'Dashboard':view==='Practice'?'Your Library':view}</h2></div>
        <div className="rb-toolbar-actions"><button className="rb-icon-button" aria-label="Switch appearance" title="Switch light / dark" onClick={()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}><Sun size={18}/></button>{view==='Settings'?<span className="rb-saved"><span className="status-dot"/>{user?.isCloud||user?.uid?'Synced to Google Cloud':'Saved on this device'}</span>:<button className="primary" onClick={()=>{setSearch('');setSection('All sections');switchView('Practice')}}><BookOpen size={17}/> {view==='Practice'?'Browse all skills':'Start practice'}</button>}</div>
      </header>
      {mobileSidebarOpen&&<button className="rb-mobile-scrim" aria-label="Close navigation" onClick={()=>setMobileSidebarOpen(false)}/>}
      <AnimatePresence>{portraitDock && !(opened && view === 'Practice') && (<div className="rb-floating-dock-wrapper"><FloatingDock items={navItems.map(({ key, label, icon: Icon }) => ({ title: label, icon: <Icon className="h-full w-full" strokeWidth={1.9} />, active: view === key, badge: key === 'Mistakes' && reviewQueue.length > 0 ? reviewQueue.length : undefined, onClick: () => switchView(key) }))} /></div>)}</AnimatePresence>
      <aside className="sidebar" inert={portraitDock||smallViewport?!mobileSidebarOpen:collapsed} role={(portraitDock||smallViewport)&&mobileSidebarOpen?"dialog":undefined} aria-modal={(portraitDock||smallViewport)&&mobileSidebarOpen?true:undefined} aria-label="Study navigation">
        <div className="rb-side-brand"><a className="brand" href="/" aria-label="RedBookPrep home"><span className="brand-mark"><BookOpen size={22}/></span><div><b>RedBookPrep</b><small>A little practice.<br/>More possibility.</small></div></a><button ref={closeSidebarRef} className="sidebar-toggle rb-icon-button" aria-label="Close sidebar" onClick={toggleSidebar}><PanelLeft size={19}/></button></div>
        <nav aria-label="Main navigation">{navItems.map(({key,label,icon:Icon})=><button key={key} aria-current={view===key?'page':undefined} className={view===key?'primary':''} onClick={()=>switchView(key)}><Icon size={20} strokeWidth={1.8}/><span className="nav-label">{label}</span>{key==='Mistakes'&&reviewQueue.length>0&&<span className="rb-count">{reviewQueue.length}</span>}</button>)}</nav>
        <label className="rb-side-search"><Search size={17}/><input aria-label="Search your practice library" placeholder="Search your library" value={search} onChange={e=>{setSearch(e.target.value);setView('Practice');setOpened(false)}}/></label>
        <div className="rb-side-bottom"><div className="side-foot"><span className="status-dot"/> {user?.isCloud||user?.uid?'Synced to cloud':'Saved on this device'}<small>{user?.email?`Signed in as ${user.email}`:'Sign in with Google in Settings to sync across devices.'}</small></div><button className="rb-profile" onClick={()=>switchView('Settings')}><span className="rb-avatar">{user?.name?.[0]?.toUpperCase()||'S'}</span><span><strong>{user?.name||'Student'}</strong><small>{user?.isCloud||user?.uid?'Google Cloud synced':'Local study profile'}</small></span></button><div className="rb-side-links"><a href="/about">About</a><a href="/contact">Contact</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></div>
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

          {view === 'Vocabulary' && <Vocabulary />}

          {view === 'Question bank' && <QuestionBank questions={questions} attempts={attempts} onOpen={start} />}

          {view === 'Home' && <StudyDashboard attempts={attempts} questions={questions} user={user} due={due.length} onPractice={id=>{if(id){const i=questions.findIndex(q=>q.id===id);if(i>=0)start(i);}else if(opened&&!moduleFinished.current){setView('Practice')}else switchView('Practice')}} onProgress={()=>switchView('Progress')} onMistakes={()=>switchView('Mistakes')} />}

          {/* ============================================================== */}
          {/* PRACTICE VIEW (LIBRARY OR REDESIGNED SOLVER) */}
          {/* ============================================================== */}
          {view === 'Practice' && (
            <>
              {!opened ? (
                /* --- PRACTICE LIBRARY (COVERS) --- */
                <>
                  <div className="rb-page-heading"><div><span className="eyebrow">PRACTICE, AT YOUR PACE</span><h1>Your Library</h1><p>Pick up where you left off, or discover something new.</p></div><small>{libraryQuestions.length} practice modules</small></div>
                  {(() => {
                    const qCompleted = attempts.filter((a) => a.id === q.id).length;
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

                  <PracticeFolders questions={libraryQuestions} search={search} section={section} theme={theme} onStart={i=>start(questions.findIndex(q=>q.id===libraryQuestions[i]?.id))} onImport={importMaterial} onSearch={setSearch} onSection={setSection} />

                </>
              ) : (
                /* --- REDESIGNED PRACTICE SOLVING WORKSPACE (INSPIRED BY BLUEPRINTS) --- */
                <div className="practice-workspace-root">
                  {/* 1. Header Toolbar */}
                  <header className="practice-header-bar">
                    <div className="header-left">
                      <button
                        className="back-library-btn"
                        onClick={() => setOpened(false)}
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
                      <div className="relative">
                        <button
                          className={`header-tool-btn ${showTools ? 'active' : ''}`}
                          aria-expanded={showTools}
                          onClick={() => setShowTools((v) => !v)}
                        >
                          More
                        </button>
                        {showTools && (
                          <div className="header-dropdown-menu">
                            <button
                              onClick={() => {
                                setReadingSize((v) => (v === 'large' ? 'standard' : 'large'));
                                setShowTools(false);
                              }}
                            >
                              {readingSize === 'large' ? 'Standard text size' : 'Larger text size'}
                            </button>
                            <button
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
                            className={`pane-tab-btn ${leftTab === 'scratchpad' ? 'active' : ''}`}
                            onClick={() => setLeftTab('scratchpad')}
                          >
                            <PenTool size={14} />
                            <span>Scratchpad</span>
                          </button>
                        </div>

                        {q.section === 'Reading and Writing' && (
                          <div className="pane-tools-sub">
                            <button
                              className={`pane-mini-toggle ${lineReader ? 'active' : ''}`}
                              onClick={() => setLineReader((v) => !v)}
                              title="Toggle line reading guide"
                            >
                              Line Reader
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pane-scroll-body">
                        {leftTab === 'passage' && (
                          <div className="passage-content-card">
                            <div className="passage-badge-header">
                              <span className="source-label">{q.moduleId ? 'Imported practice' : 'Original practice'} · {q.domain}</span>
                              <h3 className="passage-main-heading">{q.passageTitle}</h3>
                            </div>

                            <div
                              className={`passage-body-text ${lineReader ? 'has-line-reader' : ''}`}
                              onMouseMove={(e) => {
                                if (lineReader) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setLineReaderPos(e.clientY - rect.top);
                                }
                              }}
                            >
                              {lineReader && (
                                <div
                                  className="line-reader-guide"
                                  style={{ top: `${lineReaderPos}px` }}
                                />
                              )}
                              {!q.passage && <div className="question-prompt-card"><p>{q.prompt}</p>{q.imageDataUrl && <img className="imported-question-image" src={q.imageDataUrl} alt={q.imageAlt || 'Question diagram'} />}</div>}
                              {q.passage && q.passage.split('\n\n').map((paragraph, pIdx) => (
                                <p key={pIdx}>{paragraph}</p>
                              ))}
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

                          <div className="question-action-toggles">
                            <button
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
                          <h2>{q.passage ? q.prompt : 'Select the correct answer choice:'}</h2>
                          {Boolean(q.passage) && q.imageDataUrl && <img className="imported-question-image" src={q.imageDataUrl} alt={q.imageAlt || 'Question diagram'} />}
                        </div>

                        {/* Options List with Elimination Tool */}
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
                                    // If choice was eliminated, un-eliminate it
                                    if (isEliminated) {
                                      toggleEliminate(optIdx, { stopPropagation: () => {} } as any);
                                    }
                                  }
                                }}
                              >
                                <button className="option-select-area" type="button" aria-pressed={isSelected} disabled={submitted} onClick={e=>{e.stopPropagation();setChoice(optIdx);if(isEliminated)toggleEliminate(optIdx,e)}}>
                                  <span className="option-letter-circle">{option.letter}</span>
                                  <span className="option-text-span">{option.text}</span>
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

                        {/* Action Bar (Check answer or Next) */}
                        <div className="question-action-bar">
                          {!submitted ? (
                            <button
                              className="submit-answer-btn"
                              disabled={choice === null}
                              onClick={submit}
                            >
                              <span>Check answer</span>
                              <Check size={16} />
                            </button>
                          ) : (
                            /* Diagnostic Feedback Card */
                            <div
                              className={`answer-result-card ${
                                choice === q.answer ? 'is-correct' : 'is-incorrect'
                              }`}
                            >
                              <div className="result-header">
                                <div className="result-status-title">
                                  {choice === q.answer ? (
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

                                {choice !== q.answer && (
                                  <span className="error-queue-badge">Saved for Review</span>
                                )}
                              </div>

                              <div className="result-explanation-body">
                                <p>{q.explanation}</p>
                              </div>

                              {/* Error Root-Cause Tagging */}
                              {choice !== q.answer && (
                                <div className="mistake-tagging-section">
                                  <span className="tagging-label">What caused this slip?</span>
                                  <div className="cause-pills-row">
                                    {['Concept Gap', 'Misread Question', 'Calculation Slip', 'Guessed'].map(
                                      (causeName) => {
                                        const currentAttempt = attempts.find((a) => a.id === q.id);
                                        const isSelectedCause = currentAttempt?.cause === causeName;
                                        return (
                                          <button
                                            key={causeName}
                                            className={`cause-tag-btn ${
                                              isSelectedCause ? 'active' : ''
                                            }`}
                                            onClick={() => {
                                              const target = attempts.find((a) => a.id === q.id);
                                              if (target) update(target, { cause: causeName });
                                            }}
                                          >
                                            {causeName}
                                          </button>
                                        );
                                      }
                                    )}
                                  </div>
                                </div>
                              )}

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
          {/* MISTAKES VIEW */}
          {/* ============================================================== */}
          {view === 'Mistakes' && (
            <>
              <span className="eyebrow">UNDERSTAND. REVISIT. GROW.</span><h1>Mistake notebook</h1>
              <p>Review mistakes, strengthen skills, and avoid repeating them.</p>

              <label className="filter">
                Content domain
                <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
                  <option>All domains</option>
                  {domains.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>

              <div className="notebook-overview">
                <strong>{reviewQueue.length} {reviewQueue.length===1?'skill':'skills'} to review</strong>
                <span>{mistakes.length} missed {mistakes.length===1?'attempt':'attempts'} saved</span>
              </div>

              {mistakes.length > 0 &&
                !mistakes.some(
                  (a) =>
                    domainFilter === 'All domains' ||
                    questions.find((q) => q.id === a.id)?.domain === domainFilter
                ) && <section className="card">No recorded mistakes in this domain.</section>}

              {!mistakes.length && (
                <section className="card">No mistakes saved yet. Complete sample practice to begin.</section>
              )}

              {mistakes
                .filter(
                  (a) =>
                    domainFilter === 'All domains' ||
                    questions.find((q) => q.id === a.id)?.domain === domainFilter
                )
                .map((a, i) => (
                  <details className="card mistake-detail" key={a.date + i}>
                    <summary>
                      <span className="eyebrow">
                        {questions.find((q) => q.id === a.id)?.section} /{' '}
                        {questions.find((q) => q.id === a.id)?.domain}
                      </span>
                      <h2>{questions.find((q) => q.id === a.id)?.skill}</h2>
                      <span className="material-status">
                        {reviewQueue.some((r) => r.id === a.id)
                          ? 'Needs review'
                          : 'Correct on latest retry'}
                      </span>
                      <span className="expand-hint">Review details ⌄</span>
                    </summary>
                    <div className="mistake-body">
                      <p>{questions.find((q) => q.id === a.id)?.passage}</p>
                      <p>{questions.find((q) => q.id === a.id)?.explanation}</p>
                      <label>
                        What happened?
                        <select value={a.cause} onChange={(e) => update(a, { cause: e.target.value })}>
                          <option value="">Choose a cause</option>
                          <option>Concept gap</option>
                          <option>Misread question</option>
                          <option>Calculation error</option>
                          <option>Guessed</option>
                        </select>
                      </label>
                      <label>
                        Personal note
                        <textarea value={a.note} onChange={(e) => update(a, { note: e.target.value })} />
                      </label>
                      <label>
                        Review date{' '}
                        <input
                          type="date"
                          value={a.review}
                          onChange={(e) => update(a, { review: e.target.value })}
                        />
                      </label>
                      <button onClick={() => start(questions.findIndex((q) => q.id === a.id))}>
                        Retry question
                      </button>
                    </div>
                  </details>
                ))}
            </>
          )}

          {/* ============================================================== */}
          {/* PLANNER VIEW */}
          {/* ============================================================== */}
          {view === 'Planner' && <StudyDashboard plannerOnly attempts={attempts} questions={questions} user={user} due={due.length} onPractice={id=>{const i=questions.findIndex(q=>q.id===id);if(i>=0)start(i);else switchView('Practice')}} onProgress={()=>switchView('Progress')} onMistakes={()=>switchView('Mistakes')} />}

          {view === 'Settings' && <><h1>Settings</h1><p>Make this space yours.</p><div className="rb-settings-grid">
            <section className="card settings-panel"><h2>Appearance</h2><label><span>Appearance<small>Use a light, dark, or device-matched theme.</small></span><select value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><label><span>Accent color</span><select value={accent} onChange={e=>setAccent(e.target.value)}><option value="amber">Claude Amber</option><option value="azure">Azure Blue</option><option value="silver">Silver Grey</option></select></label><label><span>Hide sidebar<small>Open it again from the toolbar.</small></span><input type="checkbox" checked={collapsed} onChange={e=>setCollapsed(e.target.checked)}/></label><label><span>Reduce motion</span><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/></label><label><span>Increase contrast</span><input type="checkbox" checked={highContrast} onChange={e=>setHighContrast(e.target.checked)}/></label><label><span>Reduce transparency<small>Use solid surfaces in place of glass.</small></span><input type="checkbox" checked={solidGlass} onChange={e=>setSolidGlass(e.target.checked)}/></label></section>
            <section className="card settings-panel"><h2>Practice</h2><label><span>Reading size</span><select value={readingSize} onChange={e=>setReadingSize(e.target.value)}><option value="standard">Standard</option><option value="large">Large</option></select></label><label><span>Focused practice<small>Hide secondary tools during a session.</small></span><input type="checkbox" checked={focusPractice} onChange={e=>setFocusPractice(e.target.checked)}/></label><label><span>Reading pane width<small>Drag the divider during practice, or use its arrow keys.</small></span><div className="rb-range"><input aria-label="Reading pane width" type="range" min="30" max="70" value={readingSplit} onChange={e=>setReadingSplit(Number(e.target.value))}/><small>{readingSplit.toFixed(0)}%</small></div></label><div className="rb-group-body"><Info size={18}/><p>Your answers save in this browser. A saved explanation and ordinary grading never use AI credits.</p></div></section>
            <section className="card settings-panel"><h2>Your profile &amp; Cloud Sync</h2><div className="rb-group-body"><div className="rb-profile"><span className="rb-avatar">{user?.name?.[0]?.toUpperCase()||'S'}</span><span><strong>{user?.name||'Student'}</strong><small>{user?.isCloud||user?.uid?`Cloud synced (${user.email})`:'Local study profile'}</small></span></div><p>{user?.isCloud||user?.uid?'Your progress, notes, and study plan automatically sync to your cloud account across devices.':'Sign in with Google so your practice history and study plan are backed up and restored on any device.'}</p><div className="rb-actions">{!(user?.isCloud||user?.uid)&&isFirebaseConfigured&&<button className="primary" onClick={async()=>{const auth=getFirebaseAuth();if(!auth)return;try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch{window.location.href='/login';}}}>Sign in with Google</button>}<a className="rb-link-button" href="/login"><UserRound size={17}/>{user?.isCloud||user?.uid?'Switch account':'Sign in / Sign up'}</a>{user&&<button onClick={async()=>{const auth=getFirebaseAuth();if(auth)try{await signOut(auth)}catch{};localStorage.removeItem('redbookprep-user');setUser(null)}}>Sign out</button>}</div></div></section>
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
                  const answerById = new Map(group.items.map((item) => [item.id, item.answer]));
                  const rows = attempts.filter((a) => answerById.has(a.id));
                  const correctCount = rows.filter((a) => a.choice === answerById.get(a.id)).length;
                  const solvedUnique = new Set(rows.map((a) => a.id)).size;
                  const avgSeconds = rows.length ? Math.round(rows.reduce((n, a) => n + a.seconds, 0) / rows.length) : 0;
                  const skillAccuracy = rows.length ? Math.round((correctCount / rows.length) * 100) : 0;
                  const firstQuestionIndex = questions.findIndex((q) => answerById.has(q.id));
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
                const i=questions.findIndex(q=>q.id===item.id);
                const answered =
                  (i === index ? choice !== null : questionDrafts.current[i]?.choice != null);
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
                        : (i === index ? choice !== null : questionDrafts.current[i]?.choice != null)
                        ? 'In progress'
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
              <div className="navigator-grid">{moduleAnswers.map(({question, draft}, i) => <button key={question.id} onClick={() => navigateQuestion(questions.findIndex(q=>q.id===question.id))} className={draft?.choice != null ? 'answered' : ''}>
                <strong>{i + 1}</strong><span>{draft?.choice != null ? 'Answered' : 'Unanswered'}{flagged.includes(question.id) ? ' · ⚑ Flagged' : ''}</span>
              </button>)}</div>
              <div className="module-actions"><button onClick={() => setModuleStage('')}>Continue answering</button><button className="primary" onClick={finishModule}>Finish module</button></div>
            </> : <>
              <p>Your results are saved on this device. Review the explanations below or return to your library.</p>
              <div className="module-results">{moduleAnswers.map(({question, draft}, i) => <details key={question.id}>
                <summary>Question {i + 1} · {draft?.choice == null ? 'Unanswered' : draft.choice === question.answer ? 'Correct' : 'Incorrect'}</summary>
                <p>{question.prompt}</p>
                <p>Your answer: {draft?.choice == null ? 'No answer' : question.options[draft.choice].text}</p>
                <p>Correct answer: {question.options[question.answer].text}</p><p>{question.explanation}</p>
              </details>)}</div>
              <div className="module-actions"><button className="primary" onClick={() => {setModuleStage('');setOpened(false);}}>Return to library</button></div>
            </>}
          </section>
        </div>
      )}

      <GraphCalculator open={showCalculator && opened && view === 'Practice' && q.section === 'Math'} onClose={() => setShowCalculator(false)} />

      <footer className="rb-app-footer">
        <p>RedBookPrep · Independent SAT preparation. Sample content is not official test material.</p>
      </footer>
    </main>
  );
}
