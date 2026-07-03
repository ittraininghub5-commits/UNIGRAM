import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { Profile } from '@/src/types';
import { User } from '@supabase/supabase-js';
import { monitoring } from '@/src/monitoring';

// ─── Eagerly loaded (needed on first paint for every user) ────────────────────
import Navbar from '@/src/components/Navbar';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { useTheme } from '@/src/context/ThemeContext';
import { getHomeRouteForRole, isMentorRole, normalizeUserRole } from '@/src/lib/roles';
import LandingPage from '@/src/pages/LandingPage';
import AuthPage from '@/src/pages/AuthPage';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page (and its CSS/deps) is only downloaded when first navigated to.
const FeedPage               = lazy(() => import('@/src/pages/FeedPage'));
const MentorDashboard        = lazy(() => import('@/src/pages/MentorDashboard'));
const ProfilePage            = lazy(() => import('@/src/pages/ProfilePage'));
const SearchPage             = lazy(() => import('@/src/pages/SearchPage'));
const MessagesPage           = lazy(() => import('@/src/pages/MessagesPage'));
const CourseDetailPage       = lazy(() => import('@/src/pages/CourseDetailPage'));
const MyCoursesPage          = lazy(() => import('@/src/pages/MyCoursesPage'));
const CertificatesPage       = lazy(() => import('@/src/pages/Certificatespage'));
const QuizPage               = lazy(() => import('@/src/pages/QuizPage'));
const NotificationsPage      = lazy(() => import('@/src/pages/NotificationsPage'));
const SettingsPage           = lazy(() => import('@/src/pages/SettingsPage'));

// Games — GamesPage.css and GamePage.css are imported inside these modules,
// so they are no longer shipped to every route globally.
const GamesPage              = lazy(() => import('@/src/pages/GamesPage'));

// Synapse / Collab pages — large feature rarely visited on first load
const SynapsePage            = lazy(() => import('@/src/pages/SynapsePage'));
const SynapseCreatePage      = lazy(() => import('@/src/pages/SynapseCreatePage'));
const SynapseDiscoverPage    = lazy(() => import('@/src/pages/SynapseDiscoverPage'));
const SynapseConnectPage     = lazy(() => import('@/src/pages/SynapseConnectPage'));
const SynapseAchievementsPage = lazy(() => import('@/src/pages/SynapseAchievementsPage'));
const SynapseProfilePage     = lazy(() => import('@/src/pages/SynapseProfilePage'));

// Mentor-only pages
const IssuedCertificatesPage = lazy(() => import('@/src/pages/IssuedCertificatesPage'));
const PendingRequestsPage    = lazy(() => import('@/src/pages/PendingRequestsPage'));
const NewCoursePage          = lazy(() => import('@/src/pages/NewCoursePage'));

// ─── Suspense fallback ────────────────────────────────────────────────────────
// Shown while any lazy page chunk is downloading.
function PageLoader() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-accent-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Route monitoring ─────────────────────────────────────────────────────────
function RouteMonitoring() {
  const location = useLocation();
  const routeStartedAt = useRef(performance.now());

  useEffect(() => {
    const startedAt = routeStartedAt.current;
    requestAnimationFrame(() => {
      monitoring.track('page_viewed', {
        path: location.pathname,
        search: location.search,
        render_duration_ms: Math.round(performance.now() - startedAt),
      });
      routeStartedAt.current = performance.now();
    });
  }, [location.pathname, location.search]);

  return null;
}

// ─── Lazy game-page resolver ──────────────────────────────────────────────────
// GamePages exports four named components. We resolve them lazily after
// the chunk loads so each route still gets its own wrapper.
function LazyGamePage({ game }: { game: 'reaction' | 'typing' | 'memory' | 'hunter' }) {
  const map = {
    reaction: lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.ReactionGamePage }))),
    typing:   lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.TypingGamePage   }))),
    memory:   lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.MemoryGamePage   }))),
    hunter:   lazy(() => import('@/src/pages/GamePages').then((m) => ({ default: m.HunterGamePage   }))),
  } as const;
  const Component = map[game];
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { theme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        monitoring.identify(session.user.id, {
          email_domain: session.user.email?.split('@')[1],
        });
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      monitoring.track('auth_state_changed', {
        event: _event,
        has_session: !!session,
      });
      setUser(session?.user ?? null);
      if (session?.user) {
        monitoring.identify(session.user.id, {
          email_domain: session.user.email?.split('@')[1],
        });
        fetchProfile(session.user);
      } else {
        monitoring.reset();
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (authUser: User) => {
    try {
      const metadataAvatar =
        typeof authUser.user_metadata?.avatar_url === 'string'
          ? authUser.user_metadata.avatar_url
          : typeof authUser.user_metadata?.picture === 'string'
            ? authUser.user_metadata.picture
            : null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const fallbackRole = normalizeUserRole(authUser.user_metadata?.role);
        const institution = typeof authUser.user_metadata?.institution === 'string'
          ? authUser.user_metadata.institution.trim() || null
          : null;
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
          .select('*')
          .maybeSingle();

        if (createError) throw createError;
        setProfile((created || {
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          role: fallbackRole,
          institution,
          avatar_url: metadataAvatar,
        } || null) as Profile | null);
      } else {
        if (!data.avatar_url && metadataAvatar) {
          const optimisticProfile = { ...data, avatar_url: metadataAvatar };
          const { data: updated } = await supabase
            .from('profiles')
            .update({ avatar_url: metadataAvatar })
            .eq('id', authUser.id)
            .select('*')
            .maybeSingle();
          setProfile((updated || optimisticProfile || null) as Profile | null);
          return;
        }
        setProfile((data || null) as Profile | null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      monitoring.captureException(error, { area: 'profile_fetch', user_id: authUser.id });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-height-screen bg-bg-base flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <RouteMonitoring />
        <div className="min-h-screen bg-bg-base relative overflow-hidden">
          <div className="orb orb-1" />
          <div className="orb orb-2" />

          <Navbar user={user} profile={profile} />

          {/* Single Suspense boundary — all lazy pages share the same fallback */}
          <main className="relative z-10">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Auth */}
                <Route path="/"      element={user ? <Navigate to="/feed" replace /> : <LandingPage />} />
                <Route path="/auth"  element={user ? <Navigate to="/feed" /> : <AuthPage />} />

                {/* Core */}
                <Route path="/feed"        element={user ? <FeedPage profile={profile} />                                         : <Navigate to="/auth" />} />
                <Route path="/dashboard"   element={isMentorRole(profile?.role) ? <MentorDashboard profile={profile} />           : <Navigate to="/feed" />} />
                <Route path="/profile/:id?"element={user ? <ProfilePage currentProfile={profile} />                               : <Navigate to="/auth" />} />
                <Route path="/search"      element={user ? <SearchPage />                                                          : <Navigate to="/auth" />} />
                <Route path="/messages"    element={user ? <MessagesPage profile={profile} />                                     : <Navigate to="/auth" />} />
                <Route path="/course/:id"  element={user ? <CourseDetailPage />                                                   : <Navigate to="/auth" />} />

                {/* Course-related */}
                <Route path="/courses"      element={user ? <MyCoursesPage />   : <Navigate to="/auth" />} />
                <Route path="/certificates" element={user ? <CertificatesPage />: <Navigate to="/auth" />} />
                <Route path="/quiz"         element={user ? <QuizPage />        : <Navigate to="/auth" />} />

                {/* Notifications / Settings */}
                <Route path="/notifications"     element={user ? <NotificationsPage /> : <Navigate to="/auth" />} />
                <Route path="/notificationspage" element={user ? <NotificationsPage /> : <Navigate to="/auth" />} />
                <Route path="/settings"          element={user ? <SettingsPage />      : <Navigate to="/auth" />} />

                {/* Games — CSS imported inside the lazy modules, not globally */}
                <Route path="/games"         element={user ? <GamesPage />                          : <Navigate to="/auth" />} />
                <Route path="/game/reaction" element={user ? <LazyGamePage game="reaction" />       : <Navigate to="/auth" />} />
                <Route path="/game/typing"   element={user ? <LazyGamePage game="typing" />         : <Navigate to="/auth" />} />
                <Route path="/game/memory"   element={user ? <LazyGamePage game="memory" />         : <Navigate to="/auth" />} />
                <Route path="/game/hunter"   element={user ? <LazyGamePage game="hunter" />         : <Navigate to="/auth" />} />

                {/* Synapse / Collab (aliases kept in sync) */}
                <Route path="/collab"                element={user ? <SynapsePage />                                        : <Navigate to="/auth" />} />
                <Route path="/collab/create"         element={user ? <SynapseCreatePage profile={profile} />               : <Navigate to="/auth" />} />
                <Route path="/collab/discover"       element={user ? <SynapseDiscoverPage profile={profile} />             : <Navigate to="/auth" />} />
                <Route path="/collab/connect"        element={user ? <SynapseConnectPage profile={profile} />              : <Navigate to="/auth" />} />
                <Route path="/collab/achievements"   element={user ? <SynapseAchievementsPage profile={profile} />         : <Navigate to="/auth" />} />
                <Route path="/collab/profile/:id?"   element={user ? <SynapseProfilePage currentProfile={profile} />       : <Navigate to="/auth" />} />

                <Route path="/synapse"               element={user ? <SynapsePage />                                        : <Navigate to="/auth" />} />
                <Route path="/synapse/create"        element={user ? <SynapseCreatePage profile={profile} />               : <Navigate to="/auth" />} />
                <Route path="/synapse/discover"      element={user ? <SynapseDiscoverPage profile={profile} />             : <Navigate to="/auth" />} />
                <Route path="/synapse/connect"       element={user ? <SynapseConnectPage profile={profile} />              : <Navigate to="/auth" />} />
                <Route path="/synapse/achievements"  element={user ? <SynapseAchievementsPage profile={profile} />         : <Navigate to="/auth" />} />
                <Route path="/synapse/profile/:id?"  element={user ? <SynapseProfilePage currentProfile={profile} />       : <Navigate to="/auth" />} />

                {/* Mentor-only pages */}
                <Route path="/issued-certificates"  element={isMentorRole(profile?.role) ? <IssuedCertificatesPage />      : <Navigate to="/feed" />} />
                <Route path="/pending-requests"     element={isMentorRole(profile?.role) ? <PendingRequestsPage />         : <Navigate to="/feed" />} />
                <Route path="/new-course"           element={isMentorRole(profile?.role) ? <NewCoursePage />               : <Navigate to="/feed" />} />

                {/* Catch-all */}
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