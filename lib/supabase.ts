// Supabase Auth (Google OAuth + Email OTP / Magic Link), PostgREST sync, and
// zero-friction Guest localStorage -> Cloud merge for RedBookPrep.
// Falls back cleanly to legacy Firebase sync if Supabase env vars are not yet set.

import {
  isFirebaseConfigured,
  getFirebaseAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  pullCloudProgress as pullFirebaseProgress,
  pushCloudProgress as pushFirebaseProgress,
  onAuthStateChanged as onFirebaseAuthStateChanged,
} from './firebase';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project-ref') &&
    !SUPABASE_ANON_KEY.includes('your_supabase')
);

export const isCloudConfigured = isSupabaseConfigured || isFirebaseConfigured;

export const STORAGE_KEYS = {
  user: 'redbookprep-user',
  attempts: 'redbookprep-demo',
  settings: 'redbookprep-settings',
  goals: 'redbookprep-dashboard-goals',
  plan: 'redbookprep-study-plan',
  supabaseSession: 'redbookprep-supabase-session',
} as const;

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: SupabaseUser;
}

const SLIP_CAUSE_MAP: Record<string, string> = {
  'concept gap': 'Concept Gap',
  'misread question': 'Misread Question',
  'calculation slip': 'Calculation Slip',
  'calculation error': 'Calculation Slip',
  guessed: 'Guessed',
};

export function normalizeSlipCause(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return SLIP_CAUSE_MAP[raw.trim().toLowerCase()] || raw.trim();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getStoredSupabaseSession(): SupabaseSession | null {
  if (typeof window === 'undefined') return null;
  const session = readJson<SupabaseSession | null>(STORAGE_KEYS.supabaseSession, null);
  if (!session?.access_token || !session?.user?.id) return null;
  return session;
}

function saveSupabaseSession(session: SupabaseSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEYS.supabaseSession);
    } else {
      localStorage.setItem(STORAGE_KEYS.supabaseSession, JSON.stringify(session));
    }
  } catch {}
}

function supabaseHeaders(accessToken?: string): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function refreshSupabaseSession(): Promise<SupabaseSession | null> {
  const current = getStoredSupabaseSession();
  if (!isSupabaseConfigured || !current?.refresh_token) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (current.expires_at && current.expires_at - 60 > nowSec) {
    return current;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) saveSupabaseSession(null);
      return null;
    }
    const data = await res.json();
    if (!data?.access_token || !data?.user?.id) return null;
    const next: SupabaseSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || current.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user,
    };
    saveSupabaseSession(next);
    return next;
  } catch {
    return current;
  }
}

/** Handles OAuth / Magic Link redirect callback tokens from URL hash or query. */
export async function handleAuthRedirectFromUrl(): Promise<SupabaseSession | null> {
  if (typeof window === 'undefined' || !isSupabaseConfigured) return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const expiresIn = Number(hashParams.get('expires_in') || 3600);

  if (accessToken && refreshToken) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: supabaseHeaders(accessToken),
      });
      if (userRes.ok) {
        const user = (await userRes.json()) as SupabaseUser;
        const session: SupabaseSession = {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + expiresIn,
          user,
        };
        saveSupabaseSession(session);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return session;
      }
    } catch {}
  }

  const search = new URLSearchParams(window.location.search);
  const code = search.get('code');
  const tokenHash = search.get('token_hash');
  const otpType = search.get('type');
  if (tokenHash && otpType) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: supabaseHeaders(),
        body: JSON.stringify({ token_hash: tokenHash, type: otpType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.access_token && data?.user?.id) {
          const session: SupabaseSession = {
            access_token: data.access_token,
            refresh_token: data.refresh_token || '',
            expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
            user: data.user,
          };
          saveSupabaseSession(session);
          search.delete('token_hash');
          search.delete('type');
          const cleanSearch = search.toString();
          window.history.replaceState(
            null,
            '',
            window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '')
          );
          return session;
        }
      }
    } catch {}
  }

  if (code) {
    // Implicit/PKCE fallback check — clear orphan code param cleanly if already exchanged
    try {
      const verifier = localStorage.getItem('redbookprep-pkce-verifier');
      if (verifier) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
          method: 'POST',
          headers: supabaseHeaders(),
          body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
        });
        localStorage.removeItem('redbookprep-pkce-verifier');
        if (res.ok) {
          const data = await res.json();
          if (data?.access_token && data?.user?.id) {
            const session: SupabaseSession = {
              access_token: data.access_token,
              refresh_token: data.refresh_token || '',
              expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
              user: data.user,
            };
            saveSupabaseSession(session);
            search.delete('code');
            const cleanSearch = search.toString();
            window.history.replaceState(
              null,
              '',
              window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '')
            );
            return session;
          }
        }
      }
    } catch {}
  }

  return null;
}

export async function signInWithGoogle(redirectPath = '/study') {
  if (isSupabaseConfigured) {
    const redirectTo = `${window.location.origin}${redirectPath}`;
    const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
      redirectTo
    )}`;
    window.location.assign(url);
    return { redirected: true as const };
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Cloud authentication is not configured yet. Add Supabase keys in environment variables.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const u = cred.user;
  const existing = await pullFirebaseProgress(u);
  const profile = {
    uid: u.uid,
    name: existing?.profile?.name || u.displayName || u.email?.split('@')[0] || 'Student',
    email: u.email || '',
    targetScore: existing?.profile?.targetScore || 1400,
    avatar: u.photoURL || existing?.profile?.avatar,
    isCloud: true,
  };
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(profile));
  await pushFirebaseProgress({ profile });
  return { redirected: false as const, profile };
}

export async function sendEmailOtp(email: string, redirectPath = '/study') {
  if (!isSupabaseConfigured) {
    throw new Error('Email OTP / Magic Link requires Supabase authentication keys.');
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      create_user: true,
      email_redirect_to: `${window.location.origin}${redirectPath}`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.msg || err?.error_description || 'Could not send email sign-in code.');
  }
  return true;
}

export async function verifyEmailOtp(email: string, token: string): Promise<SupabaseSession> {
  if (!isSupabaseConfigured) {
    throw new Error('Email OTP requires Supabase authentication keys.');
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token || !data?.user?.id) {
    throw new Error(data?.msg || data?.error_description || 'Invalid or expired 6-digit code.');
  }
  const session: SupabaseSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: data.user,
  };
  saveSupabaseSession(session);
  return session;
}

export async function signOutCloud() {
  const session = getStoredSupabaseSession();
  if (isSupabaseConfigured && session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: supabaseHeaders(session.access_token),
      });
    } catch {}
    saveSupabaseSession(null);
  }
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch {}
  }
  try {
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch {}
}

function mergeAttempts(localList: any[], remoteList: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const item of [...(Array.isArray(remoteList) ? remoteList : []), ...(Array.isArray(localList) ? localList : [])]) {
    if (!item || typeof item.id !== 'string') continue;
    const normalized = {
      ...item,
      cause: normalizeSlipCause(item.cause),
      note: typeof item.note === 'string' ? item.note : '',
      review: typeof item.review === 'string' ? item.review : '',
      date: typeof item.date === 'string' ? item.date : '',
      seconds: Number.isFinite(item.seconds) ? Math.max(0, item.seconds) : 0,
    };
    const key = `${normalized.id}::${normalized.date || normalized.choice}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, normalized);
    } else {
      byKey.set(key, {
        ...existing,
        ...normalized,
        cause: normalized.cause || existing.cause || '',
        note: normalized.note || existing.note || '',
        review: normalized.review || existing.review || '',
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  );
}

/** Pulls cloud state and merges guest local attempts/notes/goals without losing guest work. */
export async function syncGuestAndCloudState(sessionOverride?: SupabaseSession | null) {
  if (isSupabaseConfigured) {
    const session = sessionOverride || (await refreshSupabaseSession());
    if (!session?.user?.id) return null;

    const headers = supabaseHeaders(session.access_token);
    let remote: any = null;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/user_study_state?user_id=eq.${encodeURIComponent(
          session.user.id
        )}&select=profile,attempts,settings,goals,plan`,
        { headers }
      );
      if (res.ok) {
        const rows = await res.json();
        remote = Array.isArray(rows) ? rows[0] : null;
      }
    } catch {}

    const localProfile = readJson<Record<string, any> | null>(STORAGE_KEYS.user, null);
    const localAttempts = readJson<any[]>(STORAGE_KEYS.attempts, []);
    const localSettings = readJson<Record<string, any>>(STORAGE_KEYS.settings, {});
    const localGoals = readJson<Record<string, any>>(STORAGE_KEYS.goals, {});
    const localPlan = readJson<Record<string, any>>(STORAGE_KEYS.plan, {});

    const meta = session.user.user_metadata || {};
    const mergedProfile = {
      uid: session.user.id,
      name:
        remote?.profile?.name ||
        localProfile?.name ||
        meta.full_name ||
        meta.name ||
        session.user.email?.split('@')[0] ||
        'Student',
      email: session.user.email || remote?.profile?.email || localProfile?.email || '',
      targetScore: remote?.profile?.targetScore || localProfile?.targetScore || 1400,
      avatar: meta.avatar_url || meta.picture || remote?.profile?.avatar || localProfile?.avatar,
      isCloud: true,
      provider: 'supabase',
    };

    const mergedAttempts = mergeAttempts(localAttempts, remote?.attempts || []);
    const mergedSettings = { ...(remote?.settings || {}), ...localSettings };
    const mergedGoals = { ...(remote?.goals || {}), ...localGoals };
    const mergedPlan = { ...(remote?.plan || {}), ...localPlan };

    try {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(mergedProfile));
      localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(mergedAttempts));
      if (Object.keys(mergedSettings).length) {
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(mergedSettings));
      }
      if (Object.keys(mergedGoals).length) {
        localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(mergedGoals));
      }
      if (Object.keys(mergedPlan).length) {
        localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(mergedPlan));
      }
    } catch {}

    await pushCloudState({
      profile: mergedProfile,
      attempts: mergedAttempts,
      settings: mergedSettings,
      goals: mergedGoals,
      plan: mergedPlan,
    });

    return {
      profile: mergedProfile,
      attempts: mergedAttempts,
      settings: mergedSettings,
      goals: mergedGoals,
      plan: mergedPlan,
    };
  }

  return null;
}

export async function pushCloudState(partial?: {
  profile?: any;
  attempts?: any[];
  settings?: any;
  goals?: any;
  plan?: any;
}) {
  if (typeof window === 'undefined') return;

  if (isSupabaseConfigured) {
    const session = await refreshSupabaseSession();
    if (!session?.user?.id) return;

    const payload = {
      user_id: session.user.id,
      profile: partial?.profile ?? readJson(STORAGE_KEYS.user, null),
      attempts: partial?.attempts ?? readJson(STORAGE_KEYS.attempts, []),
      settings: partial?.settings ?? readJson(STORAGE_KEYS.settings, {}),
      goals: partial?.goals ?? readJson(STORAGE_KEYS.goals, {}),
      plan: partial?.plan ?? readJson(STORAGE_KEYS.plan, {}),
      updated_at: new Date().toISOString(),
    };

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_study_state?on_conflict=user_id`, {
        method: 'POST',
        headers: {
          ...supabaseHeaders(session.access_token),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
      });
    } catch {}
    return;
  }

  await pushFirebaseProgress(partial);
}

export function subscribeAuthSync(
  onSynced: (state: {
    profile: any;
    attempts?: any[];
    settings?: any;
  }) => void
) {
  if (isSupabaseConfigured) {
    let active = true;
    void (async () => {
      const fromRedirect = await handleAuthRedirectFromUrl();
      const session = fromRedirect || (await refreshSupabaseSession());
      if (!active || !session) return;
      const merged = await syncGuestAndCloudState(session);
      if (active && merged) {
        onSynced(merged);
      }
    })();
    return () => {
      active = false;
    };
  }

  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  return onFirebaseAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) return;
    await pullFirebaseProgress(fbUser);
    const profile = readJson<any>(STORAGE_KEYS.user, null) || {
      uid: fbUser.uid,
      name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student',
      email: fbUser.email || '',
      targetScore: 1400,
      avatar: fbUser.photoURL || undefined,
      isCloud: true,
    };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ ...profile, uid: fbUser.uid, isCloud: true }));
    onSynced({
      profile: { ...profile, uid: fbUser.uid, isCloud: true },
      attempts: readJson(STORAGE_KEYS.attempts, []),
      settings: readJson(STORAGE_KEYS.settings, {}),
    });
    void pushFirebaseProgress();
  });
}
