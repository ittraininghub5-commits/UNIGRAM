import { ReactNode, useCallback, useEffect, useMemo, useState, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import {
  Bell, BookOpen, Compass, FileCheck, Gamepad2, Handshake,
  LayoutDashboard, LogOut, Menu, MessageSquare, Moon, Palette,
  Search, Settings, Sun, User as UserIcon, X,
} from 'lucide-react';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { cn, getInitials } from '@/src/lib/utils';
import { isMentorRole } from '@/src/lib/roles';
import { AccentTheme, useTheme } from '@/src/context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavbarProps {
  user: User | null;
  profile: Profile | null;
}

// ─── Constants (outside component — never recreated) ─────────────────────────

const ACCENT_OPTIONS: { value: AccentTheme; label: string; swatch: string }[] = [
  { value: 'yellow', label: 'Yellow', swatch: 'bg-[#e6ff2f]' },
  { value: 'green',  label: 'Green',  swatch: 'bg-[#3ddc97]' },
  { value: 'blue',   label: 'Blue',   swatch: 'bg-[#60a5fa]' },
  { value: 'pink',   label: 'Pink',   swatch: 'bg-[#f472b6]'  },
];

const LANDING_LINKS = [
  { id: 'home',    label: 'Home'     },
  { id: 'purpose', label: 'Genesis'  },
  { id: 'about',   label: 'Features' },
  { id: 'roles',   label: 'Explore'  },
];

const TOP_ICON_BTN =
  'w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all duration-200 surface-button text-text-secondary hover:text-accent-teal';


function useScrollClass() {
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.classList.toggle('nav-scrolled', window.scrollY > 12);
    };
    onScroll(); // set initial state
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

// ─── Subcomponent: AppearanceModeButton ──────────────────────────────────────

const AppearanceModeButton = memo(function AppearanceModeButton({
  active, label, icon, onClick,
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
          : 'border-white/10 text-text-secondary hover:text-accent-teal hover:bg-bg-elevated',
      )}
    >
      {icon}
      {label}
    </button>
  );
});

// ─── Subcomponent: AppearanceMenu ────────────────────────────────────────────
// Only re-renders when mode / accent / theme change — not on scroll or nav events.

const AppearanceMenu = memo(function AppearanceMenu({
  mode, accent, theme, onSetMode, onSetAccent, onToggleTheme,
}: {
  mode: string;
  accent: AccentTheme;
  theme: string;
  onSetMode: (m: 'light' | 'dark') => void;
  onSetAccent: (a: AccentTheme) => void;
  onToggleTheme: () => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-[60] w-64 editorial-card menu-drop rounded-2xl p-4 space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-text-muted">Mode</p>
        <div className="grid grid-cols-2 gap-2">
          <AppearanceModeButton active={mode === 'light'} label="Light" icon={<Sun className="w-4 h-4" />} onClick={() => onSetMode('light')} />
          <AppearanceModeButton active={mode === 'dark'}  label="Dark"  icon={<Moon className="w-4 h-4" />} onClick={() => onSetMode('dark')}  />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-text-muted">Accent</p>
        <div className="grid grid-cols-2 gap-2">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSetAccent(opt.value)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all',
                accent === opt.value
                  ? 'border-accent-teal bg-accent-teal/10 text-text-primary'
                  : 'border-white/10 text-text-secondary hover:text-accent-teal hover:bg-bg-elevated',
              )}
            >
              <span className={cn('w-3 h-3 rounded-full', opt.swatch)} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onToggleTheme}
        className="w-full text-sm font-semibold rounded-xl bg-bg-elevated hover:border-accent-teal border border-white/10 px-3 py-2 text-text-primary"
      >
        Quick toggle to {theme === 'dark' ? 'light' : 'dark'}
      </button>
    </div>
  );
});

// ─── Subcomponent: LandingNavLinks ───────────────────────────────────────────
// Only re-renders when activeLandingSection changes — isolated from scroll noise.

const LandingNavLinks = memo(function LandingNavLinks({
  activeLandingSection, onScrollTo,
}: {
  activeLandingSection: string;
  onScrollTo: (id: string) => void;
}) {
  return (
    <div className="panel-pill rounded-full px-2 py-1 flex items-center gap-1 overflow-x-auto">
      {LANDING_LINKS.map((item) => (
        <button
          key={item.id}
          onClick={() => onScrollTo(item.id)}
          className={cn(
            'px-5 py-2 text-sm font-semibold rounded-full transition-all whitespace-nowrap',
            activeLandingSection === item.id
              ? 'bg-bg-elevated text-accent-teal shadow-sm'
              : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

// ─── Subcomponent: AppNavLinks ───────────────────────────────────────────────
// Only re-renders when route or appLinks change — not on scroll/appearance/mobile.

const AppNavLinks = memo(function AppNavLinks({
  appLinks, isActive,
}: {
  appLinks: { to: string; label: string; icon: React.ElementType }[];
  isActive: (to: string) => boolean;
}) {
  return (
    <div className="panel-pill rounded-full px-1.5 py-1 flex items-center gap-0.5 flex-nowrap">
      {appLinks.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap',
              isActive(item.to)
                ? 'bg-bg-elevated text-accent-teal shadow-sm'
                : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
});

// ─── Subcomponent: MobileLandingMenu ─────────────────────────────────────────
// Only mounts when mobileOpen && isLandingPage — isolated heavy block.

const MobileLandingMenu = memo(function MobileLandingMenu({
  activeLandingSection, onScrollTo,
}: {
  activeLandingSection: string;
  onScrollTo: (id: string) => void;
}) {
  return (
    <div className="fixed top-[82px] left-3 right-3 z-40 lg:hidden editorial-card menu-drop rounded-2xl p-3 space-y-2">
      {LANDING_LINKS.map((item) => (
        <button
          key={item.id}
          onClick={() => onScrollTo(item.id)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-xl text-sm font-medium',
            activeLandingSection === item.id
              ? 'bg-bg-elevated text-accent-teal'
              : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated',
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
  );
});

// ─── Subcomponent: MobileAppMenu ─────────────────────────────────────────────
// Only mounts when mobileOpen && isAuthenticatedApp — isolated heavy block.

const MobileAppMenu = memo(function MobileAppMenu({
  appLinks, isActive, mode, accent, onSetMode, onSetAccent,
}: {
  appLinks: { to: string; label: string; icon: React.ElementType }[];
  isActive: (to: string) => boolean;
  mode: string;
  accent: AccentTheme;
  onSetMode: (m: 'light' | 'dark') => void;
  onSetAccent: (a: AccentTheme) => void;
}) {
  return (
    <div className="fixed top-[82px] left-3 right-3 z-40 lg:hidden editorial-card menu-drop rounded-2xl p-3 space-y-2">
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
                : 'text-text-secondary hover:text-accent-teal hover:bg-bg-elevated',
            )}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <AppearanceModeButton active={mode === 'light'} label="Light" icon={<Sun className="w-4 h-4" />} onClick={() => onSetMode('light')} />
          <AppearanceModeButton active={mode === 'dark'}  label="Dark"  icon={<Moon className="w-4 h-4" />} onClick={() => onSetMode('dark')}  />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSetAccent(opt.value)}
              className={cn(
                'rounded-xl border p-2 flex items-center justify-center',
                opt.value === accent ? 'border-accent-teal bg-accent-teal/10' : 'border-white/10 bg-bg-elevated',
              )}
              title={opt.label}
            >
              <span className={cn('w-4 h-4 rounded-full', opt.swatch)} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Main Navbar ─────────────────────────────────────────────────────────────

function Navbar({ user, profile }: NavbarProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { theme, mode, accent, toggleTheme, setMode, setAccent } = useTheme();

  const [mobileOpen,           setMobileOpen]           = useState(false);
  const [appearanceOpen,       setAppearanceOpen]       = useState(false);
  const [activeLandingSection, setActiveLandingSection] = useState('home');

  // ✅ ZERO scroll re-renders — background handled entirely by CSS class on <html>
  useScrollClass();

  const isLandingPage      = useMemo(() => location.pathname === '/',     [location.pathname]);
  const isAuthenticatedApp = useMemo(() => !!user && !isLandingPage,      [user, isLandingPage]);

  const appLinks = useMemo(() => {
    if (!user) return [];
    const isMentor = isMentorRole(profile?.role);
    const links = [
      { to: '/feed',          label: 'Feed',          icon: Compass        },
      { to: '/search',        label: 'Search',        icon: Search         },
      { to: '/messages',      label: 'Messages',      icon: MessageSquare  },
      { to: '/courses',       label: 'Courses',       icon: BookOpen       },
      { to: '/collab',        label: 'Collab',        icon: Handshake      },
    ];
    
    // Add student-only links
    if (!isMentor) {
      links.push({ to: '/certificates',  label: 'Certificates',  icon: FileCheck      });
      links.push({ to: '/games',         label: 'Games',         icon: Gamepad2       });
    }
    
    // Add mentor-only links
    if (isMentor) {
      links.splice(3, 0, { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
      links.push({ to: '/issued-certificates', label: 'Certificates', icon: FileCheck });
      links.push({ to: '/In-Progress',    label: 'In-Progress', icon: Bell });
      links.push({ to: '/new-course',          label: 'New Course', icon: BookOpen });
    }
    
    links.push({ to: '/notifications', label: 'Notifications', icon: Bell           });
    links.push({ to: '/settings',      label: 'Settings',      icon: Settings       });
    links.push({ to: `/profile/${user.id}`, label: 'Profile', icon: UserIcon });
    return links;
  }, [profile?.role, user]);

  // Landing section tracker — only sets state when section actually changes
  useEffect(() => {
    if (!isLandingPage) return;
    const update = () => {
      const navOffset = 140;
      let current = 'home';
      for (const item of LANDING_LINKS) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (window.scrollY >= el.getBoundingClientRect().top + window.scrollY - navOffset) {
          current = item.id;
        }
      }
      // ✅ Only triggers re-render when section actually changes
      setActiveLandingSection((prev) => (prev === current ? prev : current));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [isLandingPage]);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setAppearanceOpen(false);
  }, [location.pathname]);

  // ✅ All callbacks stable — won't cause child re-renders
  const isActive = useCallback(
    (to: string) => {
      if (to === '/feed') return location.pathname === '/feed';
      if (to.startsWith('/profile/')) return location.pathname.startsWith('/profile');
      return location.pathname.startsWith(to);
    },
    [location.pathname],
  );

  const handleSignOut          = useCallback(async () => { await supabase.auth.signOut(); navigate('/'); }, [navigate]);
  const handleToggleAppearance = useCallback(() => setAppearanceOpen((p) => !p), []);
  const handleToggleMobile     = useCallback(() => setMobileOpen((p) => !p), []);

  const scrollToLandingSection = useCallback((sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - 104;
    setActiveLandingSection(sectionId);
    window.scrollTo({ top, behavior: 'smooth' });
    setMobileOpen(false);
  }, []);

  return (
    <>
      {/*
        ✅ data-navbar + data-authed used by CSS for scroll-based background.
        No React state involved in the background transition at all.
      */}
      <nav
        data-navbar
        data-authed={isAuthenticatedApp ? 'true' : 'false'}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-[78px]">

            {/* Logo */}
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

            {/* Centre nav */}
            {isLandingPage ? (
              <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-4">
                <LandingNavLinks
                  activeLandingSection={activeLandingSection}
                  onScrollTo={scrollToLandingSection}
                />
              </div>
            ) : (
              <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-2">
                <AppNavLinks appLinks={appLinks} isActive={isActive} />
              </div>
            )}

            {/* Right controls */}
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

              {/* Appearance — AppearanceMenu only re-renders on theme/accent change */}
              <div className="relative hidden sm:block z-[60]">
                <button onClick={handleToggleAppearance} className={TOP_ICON_BTN} aria-label="Open appearance settings">
                  <Palette className="w-5 h-5" />
                </button>
                {appearanceOpen && (
                  <AppearanceMenu
                    mode={mode}
                    accent={accent}
                    theme={theme}
                    onSetMode={setMode}
                    onSetAccent={setAccent}
                    onToggleTheme={toggleTheme}
                  />
                )}
              </div>

              {/* Profile + sign out */}
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
                  <button onClick={handleSignOut} className={TOP_ICON_BTN} title="Sign Out">
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={handleToggleMobile}
                className={cn('lg:hidden', TOP_ICON_BTN)}
                aria-label="Open menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menus — only mount when open, memo'd to prevent stale re-renders */}
      {mobileOpen && isLandingPage && (
        <MobileLandingMenu
          activeLandingSection={activeLandingSection}
          onScrollTo={scrollToLandingSection}
        />
      )}

      {mobileOpen && isAuthenticatedApp && (
        <MobileAppMenu
          appLinks={appLinks}
          isActive={isActive}
          mode={mode}
          accent={accent}
          onSetMode={setMode}
          onSetAccent={setAccent}
        />
      )}
    </>
  );
}

export default memo(Navbar);