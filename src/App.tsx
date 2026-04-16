import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import SynapseCreatePage from '@/src/pages/SynapseCreatePage';
import SynapseDiscoverPage from '@/src/pages/SynapseDiscoverPage';
import SynapseConnectPage from '@/src/pages/SynapseConnectPage';
import SynapseAchievementsPage from '@/src/pages/SynapseAchievementsPage';
import SynapseProfilePage from '@/src/pages/SynapseProfilePage';
import { 
  ReactionGamePage, 
  TypingGamePage, 
  MemoryGamePage, 
  HunterGamePage 
} from '@/src/pages/GamePages';

// Components
import Navbar from '@/src/components/Navbar';
import ErrorBoundary from '@/src/components/ErrorBoundary';
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
            <Route path="/synapse" element={user ? <SynapsePage /> : <Navigate to="/auth" />} />
            <Route path="/synapse/create" element={user ? <SynapseCreatePage profile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/synapse/discover" element={user ? <SynapseDiscoverPage profile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/synapse/connect" element={user ? <SynapseConnectPage profile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/synapse/achievements" element={user ? <SynapseAchievementsPage profile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/synapse/profile/:id?" element={user ? <SynapseProfilePage currentProfile={profile} /> : <Navigate to="/auth" />} />

            <Route path="/games" element={user ? <GamesPage /> : <Navigate to="/auth" />} />
            <Route path="/game/reaction" element={user ? <ReactionGamePage /> : <Navigate to="/auth" />} />
            <Route path="/game/typing" element={user ? <TypingGamePage /> : <Navigate to="/auth" />} />
            <Route path="/game/memory" element={user ? <MemoryGamePage /> : <Navigate to="/auth" />} />
            <Route path="/game/hunter" element={user ? <HunterGamePage /> : <Navigate to="/auth" />} />
            <Route path="/notifications" element={user ? <NotificationsPage /> : <Navigate to="/auth" />} />
            <Route path="/settings" element={user ? <SettingsPage/> : <Navigate to="/auth" />} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

          <Toaster position="bottom-center" theme={theme === 'dark' ? 'dark' : 'light'} />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
