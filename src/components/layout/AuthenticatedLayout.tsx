import { ReactNode, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/src/types';
import { isMentorRole } from '@/src/lib/roles';
import { cn } from '@/src/lib/utils';
import {
  Bell,
  BookOpen,
  Compass,
  FileCheck,
  Gamepad2,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  User as UserIcon,
} from 'lucide-react';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  user: User;
  profile: Profile | null;
}

export default function AuthenticatedLayout({ children, user, profile }: AuthenticatedLayoutProps) {
  const location = useLocation();

  const links = useMemo(() => {
    const base = [
      { to: '/feed', label: 'Feed', icon: Compass },
      { to: '/search', label: 'Search', icon: Search },
      { to: '/messages', label: 'Messages', icon: MessageSquare },
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/certificates', label: 'Certificates', icon: FileCheck },
      { to: '/games', label: 'Games', icon: Gamepad2 },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: `/profile/${user.id}`, label: 'Profile', icon: UserIcon },
    ];

    if (isMentorRole(profile?.role)) {
      base.splice(3, 0, { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
    }

    return base;
  }, [profile?.role, user.id]);

  const isActive = (to: string) => {
    if (to === '/feed') return location.pathname === '/feed';
    return location.pathname.startsWith(to);
  };

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-6 lg:px-8 pt-24">
      <div className="editorial-card rounded-2xl p-2 mb-5 overflow-x-auto">
        <nav className="flex items-center gap-1.5 min-w-max">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);

            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
                  active
                    ? 'bg-bg-elevated text-accent-teal border border-white/15'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="min-w-0 route-transition">{children}</section>
    </div>
  );
}
