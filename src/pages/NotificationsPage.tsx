import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock, MessageSquare, ShieldCheck, UserPlus, ArrowLeft } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import { Profile } from '@/src/types';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: 'message' | 'certificate' | 'enrollment' | 'follow';
  href?: string;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) {
          setItems([]);
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const userProfile = (profileData || null) as Profile | null;
        setProfile(userProfile);

        const notifications: NotificationItem[] = [];

        const { data: messagesData } = await supabase
          .from('messages')
          .select('id, content, from_id, created_at, from:profiles!messages_from_id_fkey(full_name)')
          .eq('to_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8);

        (messagesData || []).forEach((row: any) => {
          notifications.push({
            id: `msg-${row.id}`,
            title: `New message from ${row.from?.full_name || 'Mentor'}`,
            description: row.content || 'You have a new conversation update.',
            createdAt: row.created_at,
            type: 'message',
            href: '/messages',
          });
        });

        if (userProfile?.role === 'student') {
          const { data: certReqData } = await supabase
            .from('certificate_requests')
            .select('id, status, mentor_notes, reviewed_at, requested_at, course:courses(title)')
            .eq('student_id', user.id)
            .order('requested_at', { ascending: false })
            .limit(8);

          (certReqData || []).forEach((row: any) => {
            const statusLabel = row.status === 'approved' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending';
            notifications.push({
              id: `cert-${row.id}`,
              title: `Certificate request ${statusLabel}`,
              description: row.mentor_notes || `Course: ${row.course?.title || 'Your course'}`,
              createdAt: row.reviewed_at || row.requested_at,
              type: 'certificate',
              href: '/certificates',
            });
          });
        } else if (userProfile?.role === 'mentor') {
          const { data: pendingData } = await supabase
            .from('certificate_requests')
            .select('id, requested_at, student:profiles(full_name), course:courses(title)')
            .eq('mentor_id', user.id)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false })
            .limit(8);

          (pendingData || []).forEach((row: any) => {
            notifications.push({
              id: `approval-${row.id}`,
              title: 'Certificate approval pending',
              description: `${row.student?.full_name || 'Student'} requested approval for ${row.course?.title || 'a course'}`,
              createdAt: row.requested_at,
              type: 'certificate',
              href: '/dashboard',
            });
          });

          const { data: followData } = await supabase
            .from('follows')
            .select('id, created_at, follower:profiles!follows_follower_id_fkey(full_name)')
            .eq('following_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6);

          (followData || []).forEach((row: any) => {
            notifications.push({
              id: `follow-${row.id}`,
              title: 'New follower',
              description: `${row.follower?.full_name || 'A student'} started following you.`,
              createdAt: row.created_at,
              type: 'follow',
              href: '/feed',
            });
          });

          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('id, enrolled_at, student:profiles(full_name), course:courses(title, mentor_id)')
            .order('enrolled_at', { ascending: false })
            .limit(20);

          (enrollData || [])
            .filter((row: any) => row.course?.mentor_id === user.id)
            .slice(0, 8)
            .forEach((row: any) => {
              notifications.push({
                id: `enroll-${row.id}`,
                title: 'New enrollment',
                description: `${row.student?.full_name || 'A student'} enrolled in ${row.course?.title || 'your course'}`,
                createdAt: row.enrolled_at,
                type: 'enrollment',
                href: '/dashboard',
              });
            });
        }

        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(notifications.slice(0, 20));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const roleTitle = useMemo(() => {
    if (profile?.role === 'mentor') return 'Mentor Notifications';
    if (profile?.role === 'student') return 'Student Notifications';
    return 'Notifications';
  }, [profile?.role]);

  const iconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-accent-teal" />;
      case 'certificate':
        return <ShieldCheck className="w-4 h-4 text-accent-amber" />;
      case 'enrollment':
        return <CheckCircle2 className="w-4 h-4 text-accent-purple" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-accent-teal" />;
      default:
        return <Bell className="w-4 h-4 text-text-secondary" />;
    }
  };

  return (
    <div className="pt-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 space-y-6">
      <button
        onClick={() => safeNavigateBack(navigate, '/feed')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="space-y-1">
        <h1 className="text-3xl font-display font-extrabold tracking-tight">{roleTitle}</h1>
        <p className="text-sm text-text-secondary">Live updates for messages, enrollments, certificate requests, and follows.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-bg-card border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-bg-card border border-white/5 rounded-3xl p-12 text-center space-y-3">
          <Bell className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-sm text-text-secondary">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => (item.href ? navigate(item.href) : undefined)}
              className="w-full text-left bg-bg-card border border-white/5 rounded-2xl p-4 hover:border-accent-teal/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center shrink-0">
                  {iconForType(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.description}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted uppercase tracking-wider shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
