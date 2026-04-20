import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Bell, BookOpen, Compass, FileCheck, Gamepad2, LayoutDashboard, LogOut, Menu, MessageSquare, Moon, Palette, Search, Settings, Sun, User as UserIcon, X } from 'lucide-react';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { cn, getInitials } from '@/src/lib/utils';
import { isMentorRole } from '@/src/lib/roles';
import { AccentTheme, useTheme } from '@/src/context/ThemeContext';

interface NavbarProps {
  user: User | null;
  profile: Profile | null;
}

const ACCENT_OPTIONS: { value: AccentTheme; label: string; swatch: string }[] = [
  { value: 'yellow', label: 'Yellow', swatch: 'bg-[#e6ff2f]' },
  { value: 'green', label: 'Green', swatch: 'bg-[#3ddc97]' },
  { value: 'blue', label: 'Blue', swatch: 'bg-[#60a5fa]' },
  { value: 'pink', label: 'Pink', swatch: 'bg-[#f472b6]' },
];

export default function Navbar({ user, profile }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, mode, accent, toggleTheme, setMode, setAccent } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [activeLandingSection, setActiveLandingSection] = useState('home');

  const isLandingPage = location.pathname === '/';
  const isAuthenticatedApp = !!user && !isLandingPage;
  const landingLinks = [
    { id: 'home', label: 'Home' },
    { id: 'purpose', label: 'Genesis' },
    { id: 'about', label: 'Features' },
    { id: 'roles', label: 'Explore' },
  ];

  const appLinks = useMemo(() => {
    if (!user) return [];

    const links = [
      { to: '/feed', label: 'Feed', icon: Compass },
      { to: '/search', label: 'Search', icon: Search },
      { to: '/messages', label: 'Messages', icon: MessageSquare },
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/certificates', label: 'Certificates', icon: FileCheck },
      { to: '/games', label: 'Games', icon: Gamepad2 },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
    ];

    if (isMentorRole(profile?.role)) {
      links.splice(3, 0, { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
    }

    links.push({ to: `/profile/${user.id}`, label: 'Profile', icon: UserIcon });
    return links;
  }, [profile?.role, user]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isLandingPage) return;

    const updateActiveSection = () => {
      const navOffset = 140;
      let currentSection = 'home';

      for (const item of landingLinks) {
        const section = document.getElementById(item.id);
        if (!section) continue;

        const sectionTop = section.getBoundingClientRect().top + window.scrollY - navOffset;
        if (window.scrollY >= sectionTop) {
          currentSection = item.id;
        }
      }

      setActiveLandingSection(currentSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveSection);
  }, [isLandingPage]);

  useEffect(() => {
    setMobileOpen(false);
    setAppearanceOpen(false);
  }, [location.pathname]);

  const isActive = (to: string) => {
    if (to === '/feed') return location.pathname === '/feed';
    if (to.startsWith('/profile/')) return location.pathname.startsWith('/profile');
    return location.pathname.startsWith(to);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const scrollToLandingSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const navOffset = 104;
    const top = section.getBoundingClientRect().top + window.scrollY - navOffset;
    setActiveLandingSection(sectionId);
    window.scrollTo({ top, behavior: 'smooth' });
    setMobileOpen(false);
  };

  const topIconButtonClass =
    'w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-200 surface-button text-text-secondary hover:text-accent-teal';

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled || isAuthenticatedApp
            ? 'bg-bg-base/94 border-b border-white/10 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl'
            : 'bg-transparent border-b border-transparent'
        )}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-[78px]">
            <div className="flex items-center gap-3 min-w-0">
              <Link to={user ? '/feed' : '/'} className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-bg-card border border-white/10 flex items-center justify-center text-accent-teal font-display text-sm font-bold shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                  U
                </span>
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold leading-none text-accent-teal">Unigram</div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Social Learning</div>
                </div>
              </Link>
            </div>

            {isLandingPage ? (
              <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-4">
                <div className="panel-pill rounded-full px-2 py-1 flex items-center gap-1 overflow-x-auto">
                  {landingLinks.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToLandingSection(item.id)}
                      className={cn(
                        'px-5 py-2 text-sm font-semibold rounded-full transition-all whitespace-nowrap',
                        activeLandingSection === item.id
                          ? 'bg-bg-elevated text-accent-teal shadow-sm'
                          : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="hidden xl:flex items-center justify-center flex-1 min-w-0 px-4">
                <div className="panel-pill rounded-full px-2 py-1 flex items-center gap-1 overflow-x-auto">
                  {appLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all whitespace-nowrap',
                          isActive(item.to)
                            ? 'bg-bg-elevated text-accent-teal shadow-sm'
                            : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isLandingPage && (
                <div className="hidden lg:flex items-center gap-2 panel-pill px-2 py-1.5 rounded-full">
                  <Link to="/auth?mode=signin" className="px-4 py-2 text-sm font-semibold rounded-full text-text-secondary hover:text-accent-teal">
                    Sign In
                  </Link>
                  <Link to="/auth?mode=register" className="brand-button px-5 py-2 text-sm">
                    Register
                  </Link>
                </div>
              )}

              <div className="relative hidden sm:block">
                <button
                  onClick={() => setAppearanceOpen((prev) => !prev)}
                  className={topIconButtonClass}
                  aria-label="Open appearance settings"
                >
                  <Palette className="w-5 h-5" />
                </button>

                {appearanceOpen && (
                  <div className="absolute right-0 top-12 w-64 editorial-card rounded-2xl p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-text-muted">Mode</p>
                      <div className="grid grid-cols-2 gap-2">
                        <AppearanceModeButton
                          active={mode === 'light'}
                          label="Light"
                          icon={<Sun className="w-4 h-4" />}
                          onClick={() => setMode('light')}
                        />
                        <AppearanceModeButton
                          active={mode === 'dark'}
                          label="Dark"
                          icon={<Moon className="w-4 h-4" />}
                          onClick={() => setMode('dark')}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-text-muted">Accent</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ACCENT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setAccent(option.value)}
                            className={cn(
                              'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all',
                              accent === option.value
                                ? 'border-accent-teal bg-accent-teal/10 text-text-primary'
                                : 'border-white/10 text-text-secondary hover:text-accent-teal hover:bg-bg-elevated'
                            )}
                          >
                            <span className={cn('w-3 h-3 rounded-full', option.swatch)} />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={toggleTheme}
                      className="w-full text-sm font-semibold rounded-xl bg-bg-elevated hover:border-accent-teal border border-white/10 px-3 py-2 text-text-primary"
                    >
                      Quick toggle to {theme === 'dark' ? 'light' : 'dark'}
                    </button>
                  </div>
                )}
              </div>

              {!user ? null : (
                <>
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
                  <button onClick={handleSignOut} className={topIconButtonClass} title="Sign Out">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}

              <button
                onClick={() => setMobileOpen((prev) => !prev)}
                className={cn('xl:hidden', topIconButtonClass)}
                aria-label="Open menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && isLandingPage && (
        <div className="fixed top-[82px] left-3 right-3 z-40 xl:hidden editorial-card menu-drop rounded-2xl p-3 space-y-2">
          {landingLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToLandingSection(item.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-xl text-sm font-medium',
                activeLandingSection === item.id
                  ? 'bg-bg-elevated text-accent-teal'
                  : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated'
              )}
            >
              {item.label}
            </button>
          ))}

          <div className="pt-2 border-t border-white/10 space-y-2">
            <Link
              to="/auth?mode=signin"
              className="block w-full px-3 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-accent-teal hover:bg-bg-elevated"
            >
              Sign In
            </Link>
            <Link to="/auth?mode=register" className="brand-button block w-full px-3 py-2 text-sm text-center">
              Register
            </Link>
          </div>
        </div>
      )}

      {mobileOpen && isAuthenticatedApp && (
        <div className="fixed top-[82px] left-3 right-3 z-40 xl:hidden editorial-card menu-drop rounded-2xl p-3 space-y-2">
          {appLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
                  isActive(item.to)
                    ? 'bg-bg-elevated text-accent-teal'
                    : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <AppearanceModeButton
                active={mode === 'light'}
                label="Light"
                icon={<Sun className="w-4 h-4" />}
                onClick={() => setMode('light')}
              />
              <AppearanceModeButton
                active={mode === 'dark'}
                label="Dark"
                icon={<Moon className="w-4 h-4" />}
                onClick={() => setMode('dark')}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAccent(option.value)}
                  className={cn(
                    'rounded-xl border p-2 flex items-center justify-center',
                    accent === option.value ? 'border-accent-teal bg-accent-teal/10' : 'border-white/10 bg-bg-elevated'
                  )}
                  title={option.label}
                >
                  <span className={cn('w-4 h-4 rounded-full', option.swatch)} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppearanceModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
        active
          ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
          : 'border-white/10 text-text-secondary hover:text-accent-teal hover:bg-bg-elevated'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
