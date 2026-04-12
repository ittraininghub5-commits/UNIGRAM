import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { User } from '@supabase/supabase-js';
import { cn, getInitials } from '@/src/lib/utils';
import { isMentorRole } from '@/src/lib/roles';
import { Search, MessageSquare, User as UserIcon, LayoutDashboard, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/src/context/ThemeContext';
import { useState, useEffect } from 'react';

interface NavbarProps {
  user: User | null;
  profile: Profile | null;
}

export default function Navbar({ user, profile }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Update active section based on scroll position
          const sections = ['home', 'purpose', 'about', 'roles'];
          for (const section of sections) {
            const element = document.getElementById(section);
            if (element) {
              const rect = element.getBoundingClientRect();
              if (rect.top <= 100) {
                setActiveSection(section);
              }
            }
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSmoothScroll = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Scroll with offset (80px) to prevent heading overlap with navbar
      const offsetTop = element.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
      setActiveSection(sectionId);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Show navigation sections only on landing page
  const isLandingPage = location.pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-base/95 backdrop-blur-md border-b border-text-primary/5 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Left */}
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
            <span className="font-display text-xl font-extrabold tracking-tighter text-text-primary">
              Uni<span className="text-accent-teal group-hover:text-[#00f5b4] transition-colors">gram</span>
            </span>
          </Link>

          {/* Center Navigation - Always visible on landing page */}
          {isLandingPage && (
            <div className="hidden md:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
              <button
                onClick={() => handleSmoothScroll('home')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  activeSection === 'home'
                    ? "text-accent-teal bg-accent-teal/15"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                )}
              >
                Home
              </button>
              <button
                onClick={() => handleSmoothScroll('purpose')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  activeSection === 'purpose'
                    ? "text-accent-teal bg-accent-teal/15"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                )}
              >
                The Problem
              </button>
              <button
                onClick={() => handleSmoothScroll('about')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  activeSection === 'about'
                    ? "text-accent-teal bg-accent-teal/15"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                )}
              >
                About Us
              </button>
            </div>
          )}

          {/* Right side - User nav + theme + auth */}
          <div className="flex items-center gap-3">
            {/* User Navigation - Only show when logged in and not on landing page */}
            {user && !isLandingPage && (
              <div className="hidden md:flex items-center gap-1">
                <NavLink to="/feed" label="Feed" />
                <NavLink to="/search" label="Search" icon={<Search className="w-4 h-4" />} />
                <NavLink to="/messages" label="Messages" icon={<MessageSquare className="w-4 h-4" />} />
                {isMentorRole(profile?.role) && (
                  <NavLink to="/dashboard" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} />
                )}
                <NavLink to={`/profile/${user.id}`} label="Profile" icon={<UserIcon className="w-4 h-4" />} />
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                theme === 'light'
                  ? "bg-bg-elevated text-text-secondary hover:text-text-primary"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              )}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {/* Auth Buttons */}
            {!user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth?mode=signin"
                  className="text-text-secondary hover:text-text-primary px-4 py-2 text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <button
                  onClick={() => {
                    if (isLandingPage) {
                      handleSmoothScroll('roles');
                    } else {
                      navigate('/auth?mode=register');
                    }
                  }}
                  className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-5 py-2 rounded-lg text-sm font-bold font-display transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                  Register
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to={`/profile/${user.id}`}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-teal to-accent-purple p-[2px]"
                  title="Profile"
                >
                  <div className="w-full h-full rounded-full bg-bg-card overflow-hidden flex items-center justify-center text-[10px] font-bold text-accent-teal">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || 'Profile'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span style={{ display: profile?.avatar_url ? 'none' : 'flex' }}>
                      {getInitials(profile?.full_name || user.email || 'U')}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-text-secondary hover:text-text-primary p-2 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, label, icon }: { to: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-lg transition-all"
    >
      {icon}
      {label}
    </Link>
  );
}