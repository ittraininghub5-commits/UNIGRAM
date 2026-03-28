import { Link, useNavigate } from 'react-router-dom';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { User } from '@supabase/supabase-js';
import { cn } from '@/src/lib/utils';
import { Search, MessageSquare, User as UserIcon, LayoutDashboard, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/src/context/ThemeContext';

interface NavbarProps {
  user: User | null;
  profile: Profile | null;
}

export default function Navbar({ user, profile }: NavbarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-bg-base/85 backdrop-blur-2xl border-b border-white/5 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="font-display text-2xl font-extrabold tracking-tighter text-text-primary">
              Uni<span className="text-accent-teal group-hover:text-[#00f5b4] transition-colors">gram</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" label="Home" />
            {user && (
              <>
                <NavLink to="/feed" label="Feed" />
                <NavLink to="/search" label="Search" icon={<Search className="w-4 h-4" />} />
                <NavLink to="/messages" label="Messages" icon={<MessageSquare className="w-4 h-4" />} />
                {profile?.role === 'mentor' && (
                  <NavLink to="/dashboard" label="Dashboard" icon={<LayoutDashboard className="w-4 h-4" />} />
                )}
                <NavLink to={`/profile/${user.id}`} label="Profile" icon={<UserIcon className="w-4 h-4" />} />
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-bg-elevated text-text-secondary hover:text-text-primary transition-all"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {!user ? (
              <Link
                to="/auth"
                className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-5 py-2 rounded-xl text-sm font-bold font-display transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Sign In
              </Link>
            ) : (
              <button
                onClick={handleSignOut}
                className="text-text-secondary hover:text-text-primary p-2 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
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
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-xl transition-all"
    >
      {icon}
      {label}
    </Link>
  );
}
