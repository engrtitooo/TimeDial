import React, { useState, useEffect } from 'react';
import { maskEmail } from '../src/lib/email';
import { TimeParticles } from './TimeParticles';

interface AccessGateProps {
  children: React.ReactNode;
  onLogoutRef?: (logoutFn: () => void) => void;
}

type AuthStep = 'CHECKING' | 'PASSWORD' | 'OTP' | 'AUTHENTICATED';

export const AccessGate: React.FC<AccessGateProps> = ({ children }) => {
  const [step, setStep] = useState<AuthStep>('CHECKING');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Explicitly clear legacy localStorage keys & check server auth status on mount
  useEffect(() => {
    const legacyKeys = [
      'access_verified',
      'auth',
      'token',
      'session',
      'is_authenticated',
      'authenticated',
      'access_token',
      'user_access'
    ];
    legacyKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore storage access errors
      }
    });

    // --- Strict Tab Close Auto-Logout Check ---
    if (!sessionStorage.getItem('tab_session_active')) {
      // Missing flag = New tab or reopened browser. Force destroy backend session.
      fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      localStorage.clear();
      setStep('PASSWORD');
      setIsLoading(false);
      return;
    }

    checkServerAuth();
  }, []);

  const checkServerAuth = async () => {
    setStep('CHECKING');
    try {
      const response = await fetch('/api/check-auth', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setStep('AUTHENTICATED'); // Will render children
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Auth check error:", err);
    }
    
    setStep('PASSWORD');
    setIsLoading(false);
  };

  // Step 1: Verify Master Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Password verification failed.');
      }

      if (data.success && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setMaskedEmail(data.maskedEmail || maskEmail('admin@timedial.app'));
        setStep('OTP');
      } else {
        throw new Error(data.message || 'Verification challenge failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification request error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify 6-Digit Email OTP Code
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      setErrorMsg('Please enter a valid 6-digit code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeToken,
          code: otpCode.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || '2FA verification failed.');
      }

      if (data.success) {
        // Mark this specific tab as active
        sessionStorage.setItem('tab_session_active', 'true');
        
        // Re-check auth to confirm HttpOnly cookie validity
        await checkServerAuth();
      } else {
        throw new Error(data.message || 'Invalid verification code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '2FA verification error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error("Logout failed:", err);
    }
    sessionStorage.removeItem('tab_session_active');
    setStep('PASSWORD');
    setPassword('');
    setOtpCode('');
    setChallengeToken('');
    setErrorMsg(null);
  };

  // Render main app if authenticated
  if (step === 'AUTHENTICATED') {
    // Verified session active
    return (
      <div className="relative">
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={handleLogout}
            className="text-[10px] font-mono tracking-widest text-slate-400 hover:text-red-400 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-red-500/40 px-3 py-1.5 rounded-full backdrop-blur-md transition-all shadow-lg"
          >
            🔒 LOGOUT
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-slate-200 flex flex-col items-center justify-center relative font-sans p-4 overflow-hidden">
      <TimeParticles color="#fbbf24" />

      <div className="z-10 w-full max-w-md bg-slate-900/60 backdrop-blur-2xl border border-amber-500/20 rounded-3xl p-8 shadow-[0_0_80px_-15px_rgba(251,191,36,0.15)] relative animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
            <span className="text-2xl">🔑</span>
          </div>
          <h2 className="text-3xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-400 to-amber-600 tracking-tight">
            TIMEDIAL ACCESS
          </h2>
          <p className="text-slate-400 text-xs tracking-widest uppercase mt-1">
            Enterprise 2-Factor Authentication
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium text-center animate-shake">
            ⚠️ {errorMsg}
          </div>
        )}

        {step === 'CHECKING' && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-slate-400 text-xs tracking-wider uppercase">Verifying Server Session...</p>
          </div>
        )}

        {step === 'PASSWORD' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">
                Master Application Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter APP_PASSWORD..."
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold py-3.5 px-6 rounded-xl transition-all shadow-[0_0_25px_rgba(251,191,36,0.3)] disabled:opacity-50 text-sm tracking-wider uppercase"
            >
              {isLoading ? 'Verifying Password...' : 'Step 1: Continue to 2FA →'}
            </button>
          </form>
        )}

        {step === 'OTP' && (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
              <p className="text-xs text-amber-200/90 mb-1">
                Verification Code Sent To:
              </p>
              <p className="text-sm font-mono font-bold text-amber-400">
                {maskedEmail}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                (Code expires in 5 minutes)
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-slate-100 text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep('PASSWORD'); setErrorMsg(null); }}
                className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl text-xs transition-all uppercase tracking-wider"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-2/3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_25px_rgba(251,191,36,0.3)] disabled:opacity-50 text-xs tracking-wider uppercase"
              >
                {isLoading ? 'Verifying...' : 'Authenticate 🔒'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-800/80 pt-4">
          <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
            TimeDial Protected • HttpOnly Session Security
          </p>
        </div>
      </div>
    </div>
  );
};
