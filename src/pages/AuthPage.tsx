import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { Mail, Phone, Lock, User, GraduationCap, Users, ArrowRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'register';
type AuthMethod = 'email' | 'otp';
type Step = 'initial' | 'otp-verify' | 'forgot-password';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [step, setStep] = useState<Step>('initial');
  const [loading, setLoading] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Welcome back!');
      } else {
        const { data: { user }, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role
            }
          }
        });
        
        if (error) throw error;
        if (!user) throw new Error('No user returned from sign up');
        
        toast.success('Account created!');
      }
      navigate('/feed');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/feed`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.error('Phone OTP is currently disabled. Please use Email.');
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    try {
      toast.error('Phone OTP is currently disabled. Please use Email.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-extrabold tracking-tighter">
            Uni<span className="text-accent-teal">gram</span>
          </h1>
          <p className="text-sm text-text-secondary">Your professional learning platform</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'initial' && (
            <motion.div
              key="initial"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-bg-card border border-white/5 rounded-2xl p-1">
                <div className="flex">
                  <button
                    onClick={() => setMode('login')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                      mode === 'login' ? "bg-bg-elevated text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setMode('register')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                      mode === 'register' ? "bg-bg-elevated text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-bold tracking-tight">
                    {mode === 'login' ? 'Welcome back' : 'Join Unigram'}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {mode === 'login' ? 'Sign in to your account' : 'Create your account in 60 seconds'}
                  </p>
                </div>

                <div className="flex bg-bg-elevated rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setMethod('email')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all",
                      method === 'email' ? "bg-bg-card text-text-primary border border-white/5" : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button
                    onClick={() => setMethod('otp')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all",
                      method === 'otp' ? "bg-bg-card text-text-primary border border-white/5" : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    <Phone className="w-3.5 h-3.5" /> Phone OTP
                  </button>
                </div>

                {method === 'email' ? (
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {mode === 'register' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Abishek Joseph"
                            className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-accent-teal outline-none transition-all"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-accent-teal outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-accent-teal outline-none transition-all"
                        />
                      </div>
                    </div>

                    {mode === 'register' && (
                      <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">I am a</label>
                        <div className="grid grid-cols-2 gap-3">
                          <RoleOption 
                            selected={role === 'student'} 
                            onClick={() => setRole('student')}
                            icon={<GraduationCap className="w-5 h-5" />}
                            label="Student"
                            sub="Learn & grow"
                            color="teal"
                          />
                          <RoleOption 
                            selected={role === 'mentor'} 
                            onClick={() => setRole('mentor')}
                            icon={<Users className="w-5 h-5" />}
                            label="Mentor"
                            sub="Teach & inspire"
                            color="purple"
                          />
                        </div>
                      </div>
                    )}

                    {mode === 'login' && (
                      <div className="text-right">
                        <button 
                          type="button"
                          onClick={() => setStep('forgot-password')}
                          className="text-xs text-accent-teal hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <button
                      disabled={loading}
                      className="w-full bg-accent-teal hover:bg-[#00f5b4] text-bg-base py-3.5 rounded-xl font-bold font-display transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSendOTP} className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="w-20 bg-bg-elevated border border-white/5 rounded-xl py-3 text-center text-sm text-text-secondary">+91</div>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="98765 43210"
                          className="flex-1 bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm focus:border-accent-teal outline-none transition-all"
                        />
                      </div>
                    </div>
                    <button
                      disabled={loading}
                      className="w-full bg-accent-teal hover:bg-[#00f5b4] text-bg-base py-3.5 rounded-xl font-bold font-display transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Send OTP'}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                )}

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-mono"><span className="bg-bg-card px-2 text-text-muted">or continue with</span></div>
                </div>

                <button 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-bg-elevated border border-white/5 hover:border-white/10 text-text-primary py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>

                <p className="text-center text-sm text-text-secondary">
                  {mode === 'login' ? "New to Unigram?" : "Already have an account?"}
                  <button
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="text-accent-teal ml-1.5 hover:underline font-medium"
                  >
                    {mode === 'login' ? 'Create account' : 'Sign in'}
                  </button>
                </p>
              </div>
            </motion.div>
          )}

          {step === 'otp-verify' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-8 text-center"
            >
              <div className="w-16 h-16 bg-accent-teal/10 rounded-2xl flex items-center justify-center mx-auto text-3xl">📱</div>
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold tracking-tight">Check your phone</h2>
                <p className="text-sm text-text-secondary">We sent a 6-digit code to {phone}</p>
              </div>

              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    className="w-12 h-14 bg-bg-elevated border border-white/5 rounded-xl text-center text-xl font-bold focus:border-accent-teal outline-none transition-all"
                  />
                ))}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.some(d => !d)}
                  className="w-full bg-accent-teal hover:bg-[#00f5b4] text-bg-base py-3.5 rounded-xl font-bold font-display transition-all disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
                <button className="w-full text-xs text-text-muted hover:text-text-primary transition-colors">
                  Resend code in 0:30
                </button>
              </div>

              <button
                onClick={() => setStep('initial')}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mx-auto transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Try a different method
              </button>
            </motion.div>
          )}

          {step === 'forgot-password' && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-8"
            >
              <div className="w-16 h-16 bg-accent-teal/10 rounded-2xl flex items-center justify-center mx-auto text-3xl">🔐</div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-bold tracking-tight">Reset password</h2>
                <p className="text-sm text-text-secondary">Enter your email and we'll send a reset link</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm focus:border-accent-teal outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    toast.success('Reset link sent!');
                    setStep('initial');
                  }}
                  className="w-full bg-accent-teal hover:bg-[#00f5b4] text-bg-base py-3.5 rounded-xl font-bold font-display transition-all"
                >
                  Send Reset Link
                </button>
                <button
                  onClick={() => setStep('initial')}
                  className="w-full flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoleOption({ selected, onClick, icon, label, sub, color }: { selected: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string; color: 'teal' | 'purple' }) {
  const colors = {
    teal: selected ? 'border-accent-teal bg-accent-teal/10' : 'border-white/5 hover:border-accent-teal/30 bg-bg-elevated',
    purple: selected ? 'border-accent-purple bg-accent-purple/10' : 'border-white/5 hover:border-accent-purple/30 bg-bg-elevated',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl border text-left transition-all",
        colors[color]
      )}
    >
      <div className={cn("mb-3", selected ? (color === 'teal' ? 'text-accent-teal' : 'text-accent-purple') : 'text-text-muted')}>
        {icon}
      </div>
      <p className="text-sm font-bold font-display leading-tight">{label}</p>
      <p className="text-[10px] text-text-secondary mt-1">{sub}</p>
    </button>
  );
}
