import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { Profile } from '@/src/types';
import { User } from '@supabase/supabase-js';
import Navbar from '@/src/components/Navbar';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { useTheme } from '@/src/context/ThemeContext';
import { getHomeRouteForRole, isMentorRole, normalizeUserRole } from '@/src/lib/roles';
import '@/src/styles/GamesPage.css';
import '@/src/styles/GamePage.css';

const LandingPage = lazy(() => import('@/src/pages/LandingPage'));
const AuthPage = lazy(() => import('@/src/pages/AuthPage'));
const FeedPage = lazy(() => import('@/src/pages/FeedPage'));
const MentorDashboard = lazy(() => import('@/src/pages/MentorDashboard'));
const ProfilePage = lazy(() => import('@/src/pages/ProfilePage'));
const SearchPage = lazy(() => import('@/src/pages/SearchPage'));
const MessagesPage = lazy(() => import('@/src/pages/MessagesPage'));
const CourseDetailPage = lazy(() => import('@/src/pages/CourseDetailPage'));
const MyCoursesPage = lazy(() => import('@/src/pages/MyCoursesPage'));
const CertificatesPage = lazy(() => import('@/src/pages/Certificatespage'));
const QuizPage = lazy(() => import('@/src/pages/QuizPage'));
const GamesPage = lazy(() => import('@/src/pages/GamesPage'));
const NotificationsPage = lazy(() => import('@/src/pages/NotificationsPage'));
const SettingsPage = lazy(() => import('@/src/pages/SettingsPage'));
const SynapsePage = lazy(() => import('@/src/pages/SynapsePage'));
const SynapseCreatePage = lazy(() => import('@/src/pages/SynapseCreatePage'));
const SynapseDiscoverPage = lazy(() => import('@/src/pages/SynapseDiscoverPage'));
const SynapseConnectPage = lazy(() => import('@/src/pages/SynapseConnectPage'));
const SynapseAchievementsPage = lazy(() => import('@/src/pages/SynapseAchievementsPage'));
const SynapseProfilePage = lazy(() => import('@/src/pages/SynapseProfilePage'));
const ReactionGamePage = lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.ReactionGamePage })));
const TypingGamePage = lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.TypingGamePage })));
const MemoryGamePage = lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.MemoryGamePage })));
const HunterGamePage = lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.HunterGamePage })));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-accent-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { theme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchCacheRef = useRef(new Map<string, Promise<Profile | null>>());

  const fetchProfile = useCallback(async (authUser: User) => {
    const cacheKey = authUser.id;
    const pending = profileFetchCacheRef.current.get(cacheKey);
    if (pending) {
      const cachedProfile = await pending;
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    const request = (async () => {
      try {
        const metadataAvatar =
          typeof authUser.user_metadata?.avatar_url === 'string'
            ? authUser.user_metadata.avatar_url
            : typeof authUser.user_metadata?.picture === 'string'
              ? authUser.user_metadata.picture
              : null;

        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, institution, avatar_url')
          .eq('id', authUser.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          const fallbackRole = normalizeUserRole(authUser.user_metadata?.role);
          const institution = typeof authUser.user_metadata?.institution === 'string'
            ? authUser.user_metadata.institution.trim() || null
            : null;
          const fallbackProfile = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            role: fallbackRole,
            institution,
            avatar_url: metadataAvatar,
          } as Profile;

          const { data: created, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
              role: fallbackRole,
              institution,
              avatar_url: metadataAvatar,
            })
            .select('id, email, full_name, role, institution, avatar_url')
            .maybeSingle();

          if (createError) throw createError;
          return (created || fallbackProfile) as Profile;
        }

        if (!data.avatar_url && metadataAvatar) {
          const optimisticProfile = { ...data, avatar_url: metadataAvatar };
          const { data: updated } = await supabase
            .from('profiles')
            .update({ avatar_url: metadataAvatar })
            .eq('id', authUser.id)
            .select('id, email, full_name, role, institution, avatar_url')
            .maybeSingle();

          return (updated || optimisticProfile || null) as Profile | null;
        }

        return data as Profile;
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      } finally {
        profileFetchCacheRef.current.delete(cacheKey);
        setLoading(false);
      }
    })();

    profileFetchCacheRef.current.set(cacheKey, request);
    const resolvedProfile = await request;
    setProfile(resolvedProfile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="min-height-screen bg-bg-base flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-teal border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-bg-base relative overflow-hidden">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          
          <Navbar user={user} profile={profile} />
          
          <main className="relative z-10">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={user ? <Navigate to="/feed" replace /> : <LandingPage />} />
                <Route path="/auth" element={user ? <Navigate to="/feed" /> : <AuthPage />} />
                
                <Route path="/feed" element={user ? <FeedPage profile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/dashboard" element={isMentorRole(profile?.role) ? <MentorDashboard profile={profile} /> : <Navigate to="/feed" />} />
                <Route path="/profile/:id?" element={user ? <ProfilePage currentProfile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/search" element={user ? <SearchPage /> : <Navigate to="/auth" />} />
                <Route path="/messages" element={user ? <MessagesPage profile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/course/:id" element={user ? <CourseDetailPage /> : <Navigate to="/auth" />} />
                
                <Route path="/courses" element={user ? <MyCoursesPage /> : <Navigate to="/auth" />} />
                <Route path="/certificates" element={user ? <CertificatesPage /> : <Navigate to="/auth" />} />
                <Route path="/quiz" element={user ? <QuizPage /> : <Navigate to="/auth" />} />
                <Route path="/notificationspage" element={user ? <NotificationsPage /> : <Navigate to="/auth" />} />
                
                <Route path="/collab" element={user ? <SynapsePage /> : <Navigate to="/auth" />} />
                <Route path="/collab/create" element={user ? <SynapseCreatePage profile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/collab/discover" element={user ? <SynapseDiscoverPage profile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/collab/connect" element={user ? <SynapseConnectPage profile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/collab/achievements" element={user ? <SynapseAchievementsPage profile={profile} /> : <Navigate to="/auth" />} />
                <Route path="/collab/profile/:id?" element={user ? <SynapseProfilePage currentProfile={profile} /> : <Navigate to="/auth" />} />
                
                <Route path="/synapse" element={<Navigate to="/collab" replace />} />
                <Route path="/synapse/*" element={<Navigate to="/collab" replace />} />

                <Route path="/games" element={user ? <GamesPage /> : <Navigate to="/auth" />} />
                <Route path="/game/reaction" element={user ? <ReactionGamePage /> : <Navigate to="/auth" />} />
                <Route path="/game/typing" element={user ? <TypingGamePage /> : <Navigate to="/auth" />} />
                <Route path="/game/memory" element={user ? <MemoryGamePage /> : <Navigate to="/auth" />} />
                <Route path="/game/hunter" element={user ? <HunterGamePage /> : <Navigate to="/auth" />} />
                
                <Route path="/notifications" element={user ? <NotificationsPage /> : <Navigate to="/auth" />} />
                <Route path="/settings" element={user ? <SettingsPage /> : <Navigate to="/auth" />} />
                
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </main>

          <Toaster position="bottom-center" theme={theme === 'dark' ? 'dark' : 'light'} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
