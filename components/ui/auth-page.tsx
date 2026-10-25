'use client';
import {useState} from 'react';
import Link from 'next/link';
import {PublicThemeToggle} from './public-theme-toggle';
import {useRouter} from 'next/navigation';
import {BookOpen,ArrowRight,UserRound,ShieldCheck,Check,ChevronLeft,Cloud} from 'lucide-react';
import {
  isFirebaseConfigured,
  getFirebaseAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
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
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [target,setTarget]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);

  const saveLocalAndEnter=(profile:{uid?:string;name:string;email:string;targetScore?:number;avatar?:string;isCloud?:boolean})=>{
    try{
      localStorage.setItem('redbookprep-user',JSON.stringify({...profile,createdAt:new Date().toISOString()}));
      router.push('/study');
    }catch{
      setError('This browser could not save your profile. You can still try guest practice.');
    }
  };

  const handleGoogleSignIn=async()=>{
    setError('');setNotice('');
    const auth=getFirebaseAuth();
    if(!auth){
      setError('Google Cloud sign-in is awaiting Firebase configuration keys. Use the form below or continue as guest.');
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
        name:existing?.profile?.name||name.trim()||u.displayName||u.email?.split('@')[0]||'Student',
        email:u.email||'',
        targetScore:target?Number(target):existing?.profile?.targetScore,
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

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');setNotice('');
    const auth=getFirebaseAuth();
    if(auth&&email.trim()&&password){
      setBusy(true);
      try{
        const cred=mode==='signup'
          ? await createUserWithEmailAndPassword(auth,email.trim(),password)
          : await signInWithEmailAndPassword(auth,email.trim(),password);
        if(mode==='signup'&&name.trim()){
          try{await updateProfile(cred.user,{displayName:name.trim()});}catch{}
        }
        const existing=await pullCloudProgress(cred.user);
        const profile={
          uid:cred.user.uid,
          name:name.trim()||existing?.profile?.name||cred.user.displayName||cred.user.email?.split('@')[0]||'Student',
          email:cred.user.email||email.trim(),
          targetScore:target?Number(target):existing?.profile?.targetScore,
          isCloud:true,
        };
        localStorage.setItem('redbookprep-user',JSON.stringify(profile));
        await pushCloudProgress({profile});
        router.push('/study');
        return;
      }catch(err:any){
        const code=err?.code||'';
        if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')setError('Incorrect email or password.');
        else if(code==='auth/email-already-in-use')setError('An account with this email already exists. Try logging in instead.');
        else if(code==='auth/weak-password')setError('Password must be at least 6 characters.');
        else setError(err?.message||'Authentication failed.');
        setBusy(false);
        return;
      }
    }
    saveLocalAndEnter({
      name:name.trim()||email.trim().split('@')[0]||'Student',
      email:email.trim(),
      targetScore:target?Number(target):undefined,
      isCloud:false,
    });
  };

  const handleResetPassword=async()=>{
    setError('');setNotice('');
    const auth=getFirebaseAuth();
    if(!auth||!email.trim()){
      setError('Enter your email address above first to receive a password reset link.');
      return;
    }
    try{
      await sendPasswordResetEmail(auth,email.trim());
      setNotice('Password reset email sent. Check your inbox.');
    }catch(err:any){
      setError(err?.message||'Could not send password reset email.');
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
        <Link className="rb-public-brand" href="/"><span><BookOpen size={22}/></span><b>RedBookPrep</b></Link>
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
                ? 'Cloud sync is active. Sign in with Google or email to back up and restore your progress on any device.'
                : 'Sign in with Google or create a profile. Your progress saves locally and syncs to the cloud when connected.'}
            </p>
          </div>
        </section>
        <section className="rb-entry-form">
          <div className="rb-entry-form-head">
            <UserRound size={21}/>
            <h2>{mode==='signup'?'Create your RedBookPrep account':'Sign in to RedBookPrep'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <button
              type="button"
              className="rb-public-button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              style={{width:'100%',justifyContent:'center',gap:'10px',fontWeight:650}}
            >
              <GoogleMark/>
              <span>{busy?'Connecting…':'Continue with Google'}</span>
            </button>

            <div style={{display:'flex',alignItems:'center',gap:'12px',color:'var(--p-muted)',fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.08em'}}>
              <span style={{flex:1,height:1,background:'var(--p-line)'}}/>
              <span>or with email</span>
              <span style={{flex:1,height:1,background:'var(--p-line)'}}/>
            </div>

            {mode==='signup'&&(
              <label>
                Your name
                <input autoComplete="name" required={mode==='signup'} value={name} onChange={e=>setName(e.target.value)} placeholder="How should we call you?" maxLength={80}/>
              </label>
            )}
            <label>
              Email
              <input type="email" autoComplete="email" required={isFirebaseConfigured} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
            </label>
            {isFirebaseConfigured&&(
              <label>
                Password <small>{mode==='signup'?'At least 6 characters':'Your account password'}</small>
                <input type="password" minLength={6} required autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
              </label>
            )}
            {mode==='signup'&&(
              <label>
                Target SAT score <small>Optional</small>
                <input type="number" min="400" max="1600" step="10" value={target} onChange={e=>setTarget(e.target.value)} placeholder="I’m not sure yet"/>
              </label>
            )}
            {error&&<p className="rb-entry-error" role="alert">{error}</p>}
            {notice&&<p role="status" style={{fontSize:'.85rem',color:'#278267',margin:0}}>{notice}</p>}
            <button type="submit" disabled={busy} className="rb-public-button primary">
              {mode==='signup'?'Create account & continue':'Sign in to RedBookPrep'}
              <ArrowRight size={17}/>
            </button>
            <button type="button" disabled={busy} className="rb-public-button" onClick={()=>router.push('/study')}>
              Try without an account
            </button>
            <p className="rb-entry-form-small">
              {mode==='signup'?(
                <>Already have an account? <Link href="/login">Log in</Link></>
              ):(
                <>New to RedBookPrep? <Link href="/signup">Create account</Link>{isFirebaseConfigured&&<> · <button type="button" onClick={handleResetPassword} style={{background:'none',border:0,padding:0,color:'var(--p-accent)',font:'inherit',cursor:'pointer'}}>Forgot password?</button></>}</>
              )}
              {' · '}
              <Link href="/privacy">Privacy</Link>
            </p>
          </form>
        </section>
      </main>
      <footer className="rb-public-footer">
        <span>RedBookPrep · Your study space.</span>
        <div>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
