import { ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/src/types';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  user: User;
  profile: Profile | null;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return (
    <section className="min-w-0 route-transition">
      {children}
    </section>
  );
}
