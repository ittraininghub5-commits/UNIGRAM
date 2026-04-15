import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { User } from '@supabase/supabase-js';
import { cn, getInitials } from '@/src/lib/utils';
import { isMentorRole } from '@/src/lib/roles';
import { Search, MessageSquare, User as UserIcon, LayoutDashboard, LogOut, Sun, Moon, Menu, X, Home, Heart, Bell } from 'lucide-react';
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topSearch, setTopSearch] = useState('');

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

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const handleTopSearchSubmit = () => {
    const q = topSearch.trim();
    if (!q) {
      navigate('/search');
      return;
    }

    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Show navigation sections only on landing page
  const isLandingPage = location.pathname === '/';
  const isFeedPage = location.pathname === '/feed';
  const showTopAppNavigation = !!user && !isLandingPage && isFeedPage;
  const appLinks = [
    { to: '/feed', label: 'Feed', icon: <Home className="w-4 h-4" /> },
    { to: '/search', label: 'Search', icon: <Search className="w-4 h-4" /> },
    { to: '/messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
    { to: `/profile/${user?.id || ''}`, label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
  ];
  const quickActions = [
    { to: '/feed', icon: <Home className="w-4 h-4" />, label: 'Feed' },
    { to: '/messages', icon: <MessageSquare className="w-4 h-4" />, label: 'Messages' },
    { to: '/notifications', icon: <Bell className="w-4 h-4" />, label: 'Notifications' },
    { to: '/courses', icon: <Heart className="w-4 h-4" />, label: 'Courses' },
  ];
  const topIconButtonClass =
    'w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-200 surface-button text-text-secondary hover:text-accent-teal';

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-bg-base/96 border-b border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.35)]'
            : 'bg-transparent border-b border-transparent'
        )}
      >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[70px]">
          {/* Logo - Left */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
              <span className="w-8 h-8 rounded-xl bg-bg-card border border-white/10 flex items-center justify-center text-accent-teal font-display text-sm font-bold">U</span>
            </Link>
            {showTopAppNavigation && (
              <label className="hidden md:flex items-center gap-2.5 bg-bg-card border border-white/10 rounded-full px-3 py-2 text-text-muted min-w-[220px]">
                <Search className="w-4 h-4" />
                <input
                  type="text"
                  placeholder="# Explore"
                  className="bg-transparent text-xs outline-none placeholder:text-text-muted w-full"
                  value={topSearch}
                  onChange={(e) => setTopSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTopSearchSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleTopSearchSubmit}
                  className="text-[10px] font-semibold text-text-secondary hover:text-accent-teal transition-colors"
                  aria-label="Search"
                >
                  Go
                </button>
              </label>
            )}
          </div>

          {/* Center Navigation - Always visible on landing page */}
          {isLandingPage && (
            <div className="hidden lg:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2 panel-pill px-2 py-1.5 rounded-full">
              <button
                onClick={() => handleSmoothScroll('home')}
                className={cn(
                  'px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200',
                  activeSection === 'home'
                    ? 'text-text-primary bg-bg-elevated shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                Home
              </button>
              <button
                onClick={() => handleSmoothScroll('purpose')}
                className={cn(
                  'px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200',
                  activeSection === 'purpose'
                    ? 'text-text-primary bg-bg-elevated shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                The Problem
              </button>
              <button
                onClick={() => handleSmoothScroll('about')}
                className={cn(
                  'px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200',
                  activeSection === 'about'
                    ? 'text-text-primary bg-bg-elevated shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                About Us
              </button>
            </div>
          )}

          {/* Right side - User nav + theme + auth */}
          <div className="flex items-center gap-3">
            {showTopAppNavigation && (
              <div className="hidden md:flex items-center gap-2 mr-1">
                {quickActions.map((action) => (
                  <button
                    key={action.to}
                    onClick={() => navigate(action.to)}
                    title={action.label}
                    className={cn(
                      topIconButtonClass,
                      location.pathname.startsWith(action.to) && 'text-accent-teal border-accent-teal/40'
                    )}
                  >
                    {action.icon}
                  </button>
                ))}
              </div>
            )}

            {/* User Navigation - Only show when logged in and not on landing page */}
            {showTopAppNavigation && (
              <div className="hidden xl:flex items-center gap-1 panel-pill rounded-full px-2 py-1">
                <SiteNavLink to="/feed" label="Feed" active={location.pathname === '/feed'} />
                <SiteNavLink to="/search" label="Search" icon={<Search className="w-4 h-4" />} active={location.pathname.startsWith('/search')} />
                <SiteNavLink to="/messages" label="Messages" icon={<MessageSquare className="w-4 h-4" />} active={location.pathname.startsWith('/messages')} />
                {isMentorRole(profile?.role) && (
                  <SiteNavLink to="/dashboard" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} active={location.pathname.startsWith('/dashboard')} />
                )}
                <SiteNavLink to={`/profile/${user.id}`} label="Profile" icon={<UserIcon className="w-4 h-4" />} active={location.pathname.startsWith('/profile')} />
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                topIconButtonClass
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
                  className="text-text-secondary hover:text-text-primary px-4 py-2 text-sm font-semibold transition-colors"
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
                  className="brand-button px-5 py-2 text-sm"
                >
                  Register
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to={`/profile/${user.id}`}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-teal to-accent-amber p-[2px]"
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
                  className={topIconButtonClass}
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}

            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              className={cn('lg:hidden', topIconButtonClass)}
              aria-label="Open menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </nav>

    {mobileOpen && (
      <div className="fixed top-[70px] left-3 right-3 z-40 lg:hidden editorial-card menu-drop rounded-2xl p-3 space-y-2">
        {isLandingPage && (
          <>
            <button onClick={() => handleSmoothScroll('home')} className="w-full text-left px-3 py-2 rounded-xl hover:bg-bg-elevated text-sm">Home</button>
            <button onClick={() => handleSmoothScroll('purpose')} className="w-full text-left px-3 py-2 rounded-xl hover:bg-bg-elevated text-sm">The Problem</button>
            <button onClick={() => handleSmoothScroll('about')} className="w-full text-left px-3 py-2 rounded-xl hover:bg-bg-elevated text-sm">About Us</button>
          </>
        )}

        {user && appLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
              location.pathname.startsWith(item.to) ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        {user && isMentorRole(profile?.role) && (
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
              location.pathname.startsWith('/dashboard') ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        )}
      </div>
    )}
    </>
  );
}

function SiteNavLink({ to, label, icon, active }: { to: string; label: string; icon?: React.ReactNode; active?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all',
        active ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
      )}
    >
      {icon}
      {label}
    </Link>
  );
}