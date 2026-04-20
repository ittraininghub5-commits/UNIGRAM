import { ReactNode, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { Profile } from '@/src/types';
import { User } from '@supabase/supabase-js';
import SettingsPage from '@/src/pages/SettingsPage';

// Pages
import LandingPage from '@/src/pages/LandingPage';
import AuthPage from '@/src/pages/AuthPage';
import FeedPage from '@/src/pages/FeedPage';
import MentorDashboard from '@/src/pages/MentorDashboard';
import ProfilePage from '@/src/pages/ProfilePage';
import SearchPage from '@/src/pages/SearchPage';
import MessagesPage from '@/src/pages/MessagesPage';
import CourseDetailPage from '@/src/pages/CourseDetailPage';
import MyCoursesPage from '@/src/pages/MyCoursesPage';
import CertificatesPage from '@/src/pages/Certificatespage';
import QuizPage from '@/src/pages/QuizPage';
import GamesPage from '@/src/pages/GamesPage';
import NotificationsPage from '@/src/pages/NotificationsPage';
import SynapsePage from '@/src/pages/SynapsePage';
import { 
  ReactionGamePage, 
  TypingGamePage, 
  MemoryGamePage, 
  HunterGamePage 
} from '@/src/pages/GamePages';

// Components
import Navbar from '@/src/components/Navbar';
import AuthenticatedLayout from '@/src/components/layout/AuthenticatedLayout';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import LiveBackground from '@/src/components/LiveBackground';
import { useTheme } from '@/src/context/ThemeContext';
import { getHomeRouteForRole, isMentorRole, normalizeUserRole } from '@/src/lib/roles';
import '@/src/styles/GamesPage.css';
import '@/src/styles/GamePage.css';

export default function App() {
  const { theme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ ORIGINAL LOGIC (UNCHANGED)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      } else {
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
    } finally {
      setLoading(false);
    }
  };

  const renderAuthed = (page: ReactNode) => {
    if (!user) {
      return <Navigate to="/auth" />;
    }

    return (
      <AuthenticatedLayout user={user} profile={profile}>
        {page}
      </AuthenticatedLayout>
    );
  };

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
        <div className="min-h-screen bg-bg-base relative overflow-x-hidden">
        <LiveBackground />
        
        <Navbar user={user} profile={profile} />
        
        <main className="relative z-10 pb-12">
          <AnimatedAppRoutes
            user={user}
            profile={profile}
            renderAuthed={renderAuthed}
          />
        </main>

          <Toaster position="bottom-center" theme={theme} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

function AnimatedAppRoutes({
  user,
  profile,
  renderAuthed,
}: {
  user: User | null;
  profile: Profile | null;
  renderAuthed: (page: ReactNode) => ReactNode;
}) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 14, scale: 0.996 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.998 }}
        transition={{ duration: 0.36, ease: [0.22, 0.8, 0.24, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={user ? <Navigate to="/feed" replace /> : <LandingPage />} />
          <Route path="/auth" element={user ? <Navigate to="/feed" /> : <AuthPage />} />
          <Route path="/feed" element={renderAuthed(<FeedPage profile={profile} />)} />
          <Route path="/dashboard" element={isMentorRole(profile?.role) ? renderAuthed(<MentorDashboard profile={profile} />) : <Navigate to="/feed" />} />
          <Route path="/profile/:id?" element={renderAuthed(<ProfilePage currentProfile={profile} />)} />
          <Route path="/search" element={renderAuthed(<SearchPage />)} />
          <Route path="/messages" element={renderAuthed(<MessagesPage profile={profile} />)} />
          <Route path="/course/:id" element={renderAuthed(<CourseDetailPage />)} />

          <Route path="/courses" element={renderAuthed(<MyCoursesPage />)} />
          <Route path="/collab" element={renderAuthed(<SynapsePage />)} />
          <Route path="/certificates" element={renderAuthed(<CertificatesPage />)} />
          <Route path="/quiz" element={renderAuthed(<QuizPage />)} />
          <Route path="/notificationspage" element={renderAuthed(<NotificationsPage />)} />

          <Route path="/games" element={renderAuthed(<GamesPage />)} />
          <Route path="/game/reaction" element={renderAuthed(<ReactionGamePage />)} />
          <Route path="/game/typing" element={renderAuthed(<TypingGamePage />)} />
          <Route path="/game/memory" element={renderAuthed(<MemoryGamePage />)} />
          <Route path="/game/hunter" element={renderAuthed(<HunterGamePage />)} />
          <Route path="/notifications" element={renderAuthed(<NotificationsPage />)} />
          <Route path="/settings" element={renderAuthed(<SettingsPage />)} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}
