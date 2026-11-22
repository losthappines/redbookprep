'use client';
import {useState} from 'react';
import Link from 'next/link';
import {PublicThemeToggle} from './public-theme-toggle';
import {useRouter} from 'next/navigation';
import {UserRound,ShieldCheck,Check,ChevronLeft,Cloud,Mail,ArrowRight} from 'lucide-react';
import {
  isCloudConfigured,
  isSupabaseConfigured,
  signInWithGoogle,
  sendEmailOtp,
  verifyEmailOtp,
  syncGuestAndCloudState,
} from '@/lib/supabase';

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
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState('');
  const [otpSent,setOtpSent]=useState(false);
  const [otpCode,setOtpCode]=useState('');

  const handleGoogleSignIn=async()=>{
    setError('');
    setStatus('');
    if(!isCloudConfigured){
      setError('Cloud sign-in is currently unavailable. Please configure Supabase authentication keys.');
      return;
    }
    setBusy(true);
    try{
      const result=await signInWithGoogle('/study');
      if(!result.redirected){
        router.push('/study');
      }
    }catch(err:any){
      const code=err?.code||'';
      if(code==='auth/popup-closed-by-user')setError('Google sign-in window was closed before finishing.');
      else if(code==='auth/unauthorized-domain')setError('Add redbookprep.site to your authorized authentication domains.');
      else setError(err?.message||'Could not sign in with Google.');
      setBusy(false);
    }
  };

  const handleSendOtp=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');
    setStatus('');
    if(!email.trim())return;
    setBusy(true);
    try{
      await sendEmailOtp(email,'/study');
      setOtpSent(true);
      setStatus('We sent a 6-digit code and sign-in link to your email.');
    }catch(err:any){
      setError(err?.message||'Could not send sign-in code.');
    }finally{
      setBusy(false);
    }
  };

  const handleVerifyOtp=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');
    if(!otpCode.trim())return;
    setBusy(true);
    try{
      const session=await verifyEmailOtp(email,otpCode);
      await syncGuestAndCloudState(session);
      router.push('/study');
    }catch(err:any){
      setError(err?.message||'Invalid or expired verification code.');
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
          <p>Focused practice, a place for your thinking, and automatic cloud sync that merges your guest progress across every device.</p>
          <ul>
            <li><Check size={17}/>2,231+ Digital SAT Math &amp; Reading and Writing questions</li>
            <li><Check size={17}/>Cloud-synced mistake notebook, notes, and vocabulary SRS</li>
            <li><Check size={17}/>Passwordless sign in with Google or Email code / Magic Link</li>
          </ul>
          <div className="rb-entry-note">
            {isCloudConfigured ? <Cloud size={20}/> : <ShieldCheck size={20}/>}
            <p>
              {isCloudConfigured
                ? 'Cloud sync is active. Guest answers and notes on this browser merge cleanly into your account when you sign in.'
                : 'Sign in with Google or an email code once cloud environment keys are connected to back up and restore progress across devices.'}
            </p>
          </div>
        </section>
        <section className="rb-entry-form">
          <div className="rb-entry-form-head">
            <UserRound size={21}/>
            <h2>{mode==='signup'?'Create your RedBookPrep account':'Sign in to RedBookPrep'}</h2>
          </div>
          <div style={{display:'grid',gap:'18px',padding:'28px 27px'}}>
            <p style={{fontSize:'.92rem',margin:0,lineHeight:1.6}}>
              {mode==='signup'
                ? 'Continue with Google or passwordless email to create your study profile and sync local practice across devices.'
                : 'Continue with Google or a one-time email code to restore your saved SAT practice, mistake notebook, and study plan.'}
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

            {isSupabaseConfigured && (
              <div style={{display:'grid',gap:'12px',paddingTop:'6px',borderTop:'1px solid var(--line, rgba(128,128,128,.2))'}}>
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} style={{display:'grid',gap:'10px'}}>
                    <label htmlFor="auth-otp-email" style={{fontSize:'.82rem',fontWeight:600,opacity:.85}}>
                      Or sign in with email code / magic link
                    </label>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      <input
                        id="auth-otp-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e)=>setEmail(e.target.value)}
                        style={{flex:'1 1 190px',minHeight:'44px',padding:'0 14px',borderRadius:'12px',border:'1px solid rgba(128,128,128,.28)',background:'transparent',color:'inherit'}}
                      />
                      <button type="submit" className="rb-public-button primary" disabled={busy||!email.trim()} style={{minHeight:'44px',padding:'0 16px'}}>
                        <Mail size={15}/>
                        <span>Send code</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} style={{display:'grid',gap:'10px'}}>
                    <label htmlFor="auth-otp-code" style={{fontSize:'.82rem',fontWeight:600,opacity:.85}}>
                      Enter 6-digit code sent to {email}
                    </label>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      <input
                        id="auth-otp-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e)=>setOtpCode(e.target.value)}
                        style={{flex:'1 1 140px',minHeight:'44px',padding:'0 14px',borderRadius:'12px',border:'1px solid rgba(128,128,128,.28)',background:'transparent',color:'inherit',letterSpacing:'0.18em'}}
                      />
                      <button type="submit" className="rb-public-button primary" disabled={busy||!otpCode.trim()} style={{minHeight:'44px',padding:'0 16px'}}>
                        <span>Verify</span>
                        <ArrowRight size={15}/>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={()=>{setOtpSent(false);setOtpCode('');setStatus('');}}
                      style={{background:'none',border:0,padding:0,textAlign:'left',fontSize:'.8rem',opacity:.75,cursor:'pointer',color:'inherit'}}
                    >
                      Use a different email
                    </button>
                  </form>
                )}
              </div>
            )}

            {status&&<p role="status" style={{fontSize:'.85rem',margin:0,color:'#10b981'}}>{status}</p>}
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
