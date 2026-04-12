import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { getHomeRouteForRole, normalizeUserRole } from '@/src/lib/roles';
import { toast } from 'sonner';

const OAUTH_PENDING_KEY = 'unigram_oauth_pending';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [confirmationRole, setConfirmationRole] = useState<'student' | 'mentor' | null>(null);

  const getSessionWithRetry = async (attempts: number = 8, delayMs: number = 300) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        return data.session;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return null;
  };

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const queryIntent = params.get('intent');
        const queryRole = params.get('role');
        const queryInstitution = params.get('institution');
        const pendingRaw = window.sessionStorage.getItem(OAUTH_PENDING_KEY);
        const pending = pendingRaw ? JSON.parse(pendingRaw) as { intent?: string; role?: string; institution?: string | null } : null;
        const intent = queryIntent || pending?.intent || 'login';
        const requestedRole = normalizeUserRole(queryRole || pending?.role);
        const requestedInstitution = (queryInstitution || pending?.institution || '').trim() || null;
        const error = params.get('error_description') || params.get('error');

        if (error) {
          throw new Error(error);
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const session = await getSessionWithRetry();
        const user = session?.user;

        if (session && user) {
          const googleAvatar =
            typeof user.user_metadata?.avatar_url === 'string'
              ? user.user_metadata.avatar_url
              : typeof user.user_metadata?.picture === 'string'
                ? user.user_metadata.picture
                : null;

          const fallbackName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'User';
          const institution = typeof user.user_metadata?.institution === 'string'
            ? user.user_metadata.institution.trim() || null
            : null;

          const { data: existingProfile, error: profileFetchError } = await supabase
            .from('profiles')
            .select('id, role, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

          if (profileFetchError) throw profileFetchError;

          const isNewProfile = !existingProfile;
          const shouldUseRequestedRole = intent === 'register';
          let finalRole = shouldUseRequestedRole
            ? requestedRole
            : normalizeUserRole(existingProfile?.role);

          if (!existingProfile) {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email || '',
                full_name: fallbackName,
                role: finalRole,
                institution: finalRole === 'mentor' ? (requestedInstitution || institution) : institution,
                avatar_url: googleAvatar,
              });

            if (insertError) throw insertError;
          } else if (shouldUseRequestedRole) {
            const response = await fetch('/api/profile/ensure-role', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                role: requestedRole,
                institution: requestedInstitution || institution,
                fullName: fallbackName,
                intent: 'register',
              }),
            });

            const ensured = await response.json();
            if (!response.ok) {
              throw new Error(ensured?.error || 'Unable to finalize account role');
            }

            finalRole = normalizeUserRole(ensured?.profile?.role || finalRole);
          }

          if (googleAvatar && !existingProfile?.avatar_url) {
            await supabase
              .from('profiles')
              .update({ avatar_url: googleAvatar })
              .eq('id', user.id);
          }

          toast.success('Signed in with Google successfully.');
          window.sessionStorage.removeItem(OAUTH_PENDING_KEY);

          if (intent === 'register') {
            setConfirmationRole(finalRole);
            setProcessing(false);
            return;
          }

          navigate(getHomeRouteForRole(finalRole), { replace: true });
          return;
        }

        throw new Error('No active session found after Google sign-in.');
      } catch (err: any) {
        toast.error(err?.message || 'Google sign-in failed.');
        navigate('/auth', { replace: true });
      } finally {
        setProcessing(false);
      }
    };

    void completeOAuth();
  }, [navigate]);

  if (confirmationRole) {
    const destination = getHomeRouteForRole(confirmationRole);

    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
        <div className="bg-bg-card border border-white/5 rounded-2xl px-8 py-10 text-center max-w-md w-full space-y-5">
          <h2 className="text-xl font-display font-bold">
            Continue as {confirmationRole === 'mentor' ? 'Mentor' : 'Student'}
          </h2>
          <p className="text-sm text-text-secondary">
            Your Google sign-up is complete. Confirm your role to continue.
          </p>
          <button
            onClick={() => navigate(destination, { replace: true })}
            className="w-full bg-accent-teal hover:bg-[#00f5b4] text-bg-base py-3 rounded-xl font-bold"
          >
            Continue
          </button>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="w-full bg-bg-elevated border border-white/10 text-text-secondary py-3 rounded-xl text-sm"
          >
            Back to Auth
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="bg-bg-card border border-white/5 rounded-2xl px-8 py-10 text-center">
        {processing && <div className="w-10 h-10 border-4 border-accent-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>}
        <p className="text-sm text-text-secondary">Completing Google sign-in...</p>
      </div>
    </div>
  );
}
