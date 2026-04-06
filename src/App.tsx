import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { Profile } from '@/src/types';
import { User } from '@supabase/supabase-js';
await fetch("http://localhost:5000/send-email", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: "receiver@gmail.com",
    subject: "Test",
    text: "Hello!"
  })
});
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

// Components
import Navbar from '@/src/components/Navbar';
import { useTheme } from '@/src/context/ThemeContext';

export default function App() {
  const { theme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setProfile(data || null);
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
    <Router>
      <div className="min-h-screen bg-bg-base relative overflow-hidden">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        
        <Navbar user={user} profile={profile} />
        
        <main className="relative z-10">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={user ? <Navigate to="/feed" /> : <AuthPage />} />
            <Route path="/feed" element={user ? <FeedPage profile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/dashboard" element={profile?.role === 'mentor' ? <MentorDashboard profile={profile} /> : <Navigate to="/feed" />} />
            <Route path="/profile/:id?" element={user ? <ProfilePage currentProfile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/search" element={user ? <SearchPage /> : <Navigate to="/auth" />} />
            <Route path="/messages" element={user ? <MessagesPage profile={profile} /> : <Navigate to="/auth" />} />
            <Route path="/course/:id" element={user ? <CourseDetailPage /> : <Navigate to="/auth" />} />
            
            {/* New Routes - My Courses, Certificates, Quiz */}
            <Route path="/courses" element={user ? <MyCoursesPage /> : <Navigate to="/auth" />} />
            <Route path="/certificates" element={user ? <CertificatesPage /> : <Navigate to="/auth" />} />
            <Route path="/quiz" element={user ? <QuizPage /> : <Navigate to="/auth" />} />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <Toaster position="bottom-center" theme={theme === 'dark' ? 'dark' : 'light'} />
      </div>
    </Router>
  );
}