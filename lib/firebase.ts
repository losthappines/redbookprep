import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!authInstance) authInstance = getAuth(app);
  return authInstance;
}

export function getFirebaseDb(): Firestore | null {
  if (!isFirebaseConfigured) return null;
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!dbInstance) dbInstance = getFirestore(app);
  return dbInstance;
}

export type CloudUserData = {
  profile?: {
    uid?: string;
    name: string;
    email: string;
    targetScore?: number;
    testDate?: string;
    avatar?: string;
  };
  attempts?: unknown[];
  settings?: Record<string, unknown>;
  goals?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  updatedAt?: string;
};

const STORAGE_KEYS = {
  user: 'redbookprep-user',
  attempts: 'redbookprep-demo',
  settings: 'redbookprep-settings',
  goals: 'redbookprep-dashboard-goals',
  plan: 'redbookprep-study-plan',
} as const;

export async function pullCloudProgress(user: User): Promise<CloudUserData | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data() as CloudUserData;

    if (data.profile) {
      localStorage.setItem(
        STORAGE_KEYS.user,
        JSON.stringify({
          ...data.profile,
          uid: user.uid,
          name: data.profile.name || user.displayName || user.email?.split('@')[0] || 'Student',
          email: data.profile.email || user.email || '',
          avatar: data.profile.avatar || user.photoURL || undefined,
        })
      );
    }

    if (Array.isArray(data.attempts)) {
      const localRaw = JSON.parse(localStorage.getItem(STORAGE_KEYS.attempts) || '[]');
      const localList = Array.isArray(localRaw) ? localRaw : [];
      const seen = new Set(
        localList.map((a: any) => `${a?.id}|${a?.date}|${a?.choice}`)
      );
      const merged = [...localList];
      for (const item of data.attempts as any[]) {
        const key = `${item?.id}|${item?.date}|${item?.choice}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
      localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(merged));
    }

    if (data.settings && typeof data.settings === 'object') {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ ...existing, ...data.settings }));
    }

    if (data.goals && typeof data.goals === 'object') {
      localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(data.goals));
    }

    if (data.plan && typeof data.plan === 'object') {
      localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(data.plan));
    }

    return data;
  } catch {
    return null;
  }
}

export async function pushCloudProgress(patch?: Partial<CloudUserData>): Promise<boolean> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  if (!auth?.currentUser || !db) return false;
  try {
    const uid = auth.currentUser.uid;
    const localProfile = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || 'null');
    const localAttempts = JSON.parse(localStorage.getItem(STORAGE_KEYS.attempts) || '[]');
    const localSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    const localGoals = JSON.parse(localStorage.getItem(STORAGE_KEYS.goals) || 'null');
    const localPlan = JSON.parse(localStorage.getItem(STORAGE_KEYS.plan) || 'null');

    const payload: CloudUserData = {
      profile: patch?.profile ?? localProfile ?? {
        uid,
        name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Student',
        email: auth.currentUser.email || '',
        avatar: auth.currentUser.photoURL || undefined,
      },
      attempts: patch?.attempts ?? (Array.isArray(localAttempts) ? localAttempts : []),
      settings: patch?.settings ?? localSettings,
      ...(localGoals ? { goals: localGoals } : {}),
      ...(localPlan ? { plan: localPlan } : {}),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', uid), payload, { merge: true });
    return true;
  } catch {
    return false;
  }
}

export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
};
