'use client';
import {useState} from 'react';
import Link from 'next/link';
import {PublicThemeToggle} from './public-theme-toggle';
import {useRouter} from 'next/navigation';
import {UserRound,ShieldCheck,Check,ChevronLeft,Cloud} from 'lucide-react';
import {
  isFirebaseConfigured,
  getFirebaseAuth,
  GoogleAuthProvider,
  signInWithPopup,
  pullCloudProgress,
  pushCloudProgress,
} from '@/lib/firebase';

const GoogleMark = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

export default function AuthPage({mode}:{mode:'login'|'signup'}){
  const router=useRouter();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const handleGoogleSignIn=async()=>{
    setError('');
    const auth=getFirebaseAuth();
    if(!auth){
      setError('Google Cloud sign-in is currently unavailable. Please check Firebase configuration.');
      return;
    }
    setBusy(true);
    try{
      const provider=new GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      const cred=await signInWithPopup(auth,provider);
      const u=cred.user;
      const existing=await pullCloudProgress(u);
      const profile={
        uid:u.uid,
        name:existing?.profile?.name||u.displayName||u.email?.split('@')[0]||'Student',
        email:u.email||'',
        targetScore:existing?.profile?.targetScore,
        avatar:u.photoURL||existing?.profile?.avatar,
        isCloud:true,
      };
      localStorage.setItem('redbookprep-user',JSON.stringify(profile));
      await pushCloudProgress({profile});
      router.push('/study');
    }catch(err:any){
      const code=err?.code||'';
      if(code==='auth/popup-closed-by-user')setError('Google sign-in window was closed before finishing.');
      else if(code==='auth/unauthorized-domain')setError('Add redbookprep.site to Firebase Console → Authentication → Settings → Authorized domains.');
      else setError(err?.message||'Could not sign in with Google.');
    }finally{
      setBusy(false);
    }
  };

  return (
    <div className="rb-public rb-entry rb-signup">
      <div className="rb-horizon-background" aria-hidden="true">
        <div className="rb-horizon-glow"/>
        <div className="rb-horizon-wash"/>
        <div className="rb-gradient-grain"/>
      </div>
      <header className="rb-public-header">
        <Link className="rb-public-brand" href="/"><img src="/icon-192.png" alt="" width={39} height={39} className="rb-brand-logo"/><b>RedBookPrep</b></Link>
        <div className="rb-public-actions">
          <PublicThemeToggle/>
          <Link className="rb-public-button" href="/"><ChevronLeft size={16}/>Back to website</Link>
        </div>
      </header>
      <main className="rb-entry-body">
        <section className="rb-entry-intro">
          <span className="rb-eyebrow">A LITTLE PRACTICE. MORE POSSIBILITY.</span>
          <h1>{mode==='signup'?'A space for your next step.':'Pick up where you left off.'}</h1>
          <p>Focused practice, a place for your thinking, and automatic cloud sync across every device you study on.</p>
          <ul>
            <li><Check size={17}/>410+ Mathbook 3.0 practice questions & explanations</li>
            <li><Check size={17}/>Cloud-synced mistake notebook and personal notes</li>
            <li><Check size={17}/>Sign in with Google to restore progress anywhere</li>
          </ul>
          <div className="rb-entry-note">
            {isFirebaseConfigured ? <Cloud size={20}/> : <ShieldCheck size={20}/>}
            <p>
              {isFirebaseConfigured
                ? 'Cloud sync is active. Sign in with Google to back up and restore your progress on any device.'
                : 'Sign in with Google to connect your study space and sync your progress to the cloud.'}
            </p>
          </div>
        </section>
        <section className="rb-entry-form">
          <div className="rb-entry-form-head">
            <UserRound size={21}/>
            <h2>{mode==='signup'?'Create your RedBookPrep account':'Sign in to RedBookPrep'}</h2>
          </div>
          <div style={{display:'grid',gap:'20px',padding:'28px 27px'}}>
            <p style={{fontSize:'.92rem',margin:0,lineHeight:1.6}}>
              {mode==='signup'
                ? 'Continue with your Google account to create your study profile and automatically sync your SAT practice across devices.'
                : 'Continue with your Google account to restore your saved SAT practice, mistake notebook, and study plan.'}
            </p>
            <button
              type="button"
              className="rb-public-button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              style={{width:'100%',minHeight:'50px',justifyContent:'center',gap:'10px',fontWeight:650,fontSize:'.95rem'}}
            >
              <GoogleMark/>
              <span>{busy?'Connecting…':'Continue with Google'}</span>
            </button>
            {error&&<p className="rb-entry-error" role="alert">{error}</p>}
            <p className="rb-entry-form-small">
              {mode==='signup'?(
                <>Already have an account? <Link href="/login">Log in</Link></>
              ):(
                <>New to RedBookPrep? <Link href="/signup">Create account</Link></>
              )}
              {' · '}
              <Link href="/terms">Terms</Link>
              {' · '}
              <Link href="/privacy">Privacy</Link>
              <br />
              <small style={{opacity:0.8}}>Online accounts and cloud sync are intended for students aged 13 and older.</small>
            </p>
          </div>
        </section>
      </main>
      <footer className="rb-public-footer">
        <span>RedBookPrep · Independent study space. SAT® is a registered trademark of the College Board, which is not affiliated with and does not endorse RedBookPrep.</span>
        <div>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
