import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock, MessageSquare, ShieldCheck, UserPlus, ArrowLeft } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { Profile } from '@/src/types';
import { useTheme } from '@/src/context/ThemeContext';

interface Notification {
  id: string;
  category: 'badges' | 'messages' | 'achievements' | 'updates';
  title: string;
  description: string;
  time: string;
  icon: string;
  details: Record<string, string>;
  primaryAction: string;
  secondaryAction: string;
  type?: 'message' | 'certificate' | 'enrollment' | 'follow';
  createdAt?: string;
  href?: string;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real notifications from backend
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const userProfile = (profileData || null) as Profile | null;
        setProfile(userProfile);

        const notificationList: Notification[] = [];

        // Fetch Messages
        const { data: messagesData } = await supabase
          .from('messages')
          .select('id, content, from_id, created_at, from:profiles!messages_from_id_fkey(full_name)')
          .eq('to_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8);

        (messagesData || []).forEach((row: any) => {
          notificationList.push({
            id: `msg-${row.id}`,
            category: 'messages',
            title: `Message from ${row.from?.full_name || 'Instructor'}`,
            description: row.content || 'You have a new message.',
            time: new Date(row.created_at).toLocaleDateString(),
            icon: '💬',
            details: {
              'From': row.from?.full_name || 'Instructor',
              'Date': new Date(row.created_at).toLocaleDateString()
            },
            primaryAction: 'Read Message',
            secondaryAction: 'Reply',
            type: 'message',
            createdAt: row.created_at,
            href: '/messages'
          });
        });

        // Fetch Certificates/Badges
        if (userProfile?.role === 'student') {
          const { data: certReqData } = await supabase
            .from('certificate_requests')
            .select('id, status, mentor_notes, reviewed_at, requested_at, course:courses(title)')
            .eq('student_id', user.id)
            .order('requested_at', { ascending: false })
            .limit(8);

          (certReqData || []).forEach((row: any) => {
            const statusLabel = row.status === 'approved' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending';
            notificationList.push({
              id: `cert-${row.id}`,
              category: 'badges',
              title: `Certificate ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
              description: row.mentor_notes || `Course: ${row.course?.title || 'Your course'}`,
              time: new Date(row.reviewed_at || row.requested_at).toLocaleDateString(),
              icon: statusLabel === 'approved' ? '📜' : '⏳',
              details: {
                'Course': row.course?.title || 'Your course',
                'Status': statusLabel.toUpperCase()
              },
              primaryAction: statusLabel === 'approved' ? 'Download Certificate' : 'View Details',
              secondaryAction: 'View Credentials',
              type: 'certificate',
              createdAt: row.reviewed_at || row.requested_at,
              href: '/certificates'
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
            notificationList.push({
              id: `approval-${row.id}`,
              category: 'badges',
              title: 'Certificate approval pending',
              description: `${row.student?.full_name || 'Student'} requested approval for ${row.course?.title || 'a course'}`,
              time: new Date(row.requested_at).toLocaleDateString(),
              icon: '📋',
              details: {
                'Student': row.student?.full_name || 'Student',
                'Course': row.course?.title || 'Course'
              },
              primaryAction: 'Review Request',
              secondaryAction: 'Dismiss',
              type: 'certificate',
              createdAt: row.requested_at,
              href: '/dashboard'
            });
          });
        }

        // Fetch Follows (Achievements/Updates for mentors)
        if (userProfile?.role === 'mentor') {
          const { data: followData } = await supabase
            .from('follows')
            .select('id, created_at, follower:profiles!follows_follower_id_fkey(full_name)')
            .eq('following_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6);

          (followData || []).forEach((row: any) => {
            notificationList.push({
              id: `follow-${row.id}`,
              category: 'achievements',
              title: 'New follower',
              description: `${row.follower?.full_name || 'A student'} started following you.`,
              time: new Date(row.created_at).toLocaleDateString(),
              icon: '⭐',
              details: {
                'Follower': row.follower?.full_name || 'A student',
                'Date': new Date(row.created_at).toLocaleDateString()
              },
              primaryAction: 'View Profile',
              secondaryAction: 'Send Message',
              type: 'follow',
              createdAt: row.created_at,
              href: '/feed'
            });
          });

          // Fetch Enrollments
          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('id, enrolled_at, student:profiles(full_name), course:courses(title, mentor_id)')
            .order('enrolled_at', { ascending: false })
            .limit(20);

          (enrollData || [])
            .filter((row: any) => row.course?.mentor_id === user.id)
            .slice(0, 8)
            .forEach((row: any) => {
              notificationList.push({
                id: `enroll-${row.id}`,
                category: 'updates',
                title: 'New enrollment',
                description: `${row.student?.full_name || 'A student'} enrolled in ${row.course?.title || 'your course'}`,
                time: new Date(row.enrolled_at).toLocaleDateString(),
                icon: '🎓',
                details: {
                  'Student': row.student?.full_name || 'Student',
                  'Course': row.course?.title || 'Course'
                },
                primaryAction: 'View Course',
                secondaryAction: 'Send Welcome',
                type: 'enrollment',
                createdAt: row.enrolled_at,
                href: '/dashboard'
              });
            });
        }

        // Sort by date
        notificationList.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.time).getTime();
          const dateB = new Date(b.createdAt || b.time).getTime();
          return dateB - dateA;
        });

        setNotifications(notificationList);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredNotifications = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeFilter);

  const getBadgeColor = (category: string) => {
    switch (category) {
      case 'badges':
        return 'bg-accent-teal/15 text-accent-teal';
      case 'messages':
        return 'bg-accent-amber/15 text-accent-amber';
      case 'achievements':
        return 'bg-accent-teal/15 text-accent-teal';
      case 'updates':
        return 'bg-accent-amber/15 text-accent-amber';
      default:
        return 'bg-white/5 text-text-secondary';
    }
  };

  const getCardBorderColor = (category: string) => {
    switch (category) {
      case 'badges':
        return 'border-accent-teal/25 hover:border-accent-teal/60';
      case 'messages':
        return 'border-accent-amber/25 hover:border-accent-amber/60';
      case 'achievements':
        return 'border-accent-teal/25 hover:border-accent-teal/60';
      case 'updates':
        return 'border-accent-amber/25 hover:border-accent-amber/60';
      default:
        return 'border-white/10 hover:border-white/20';
    }
  };

  const getCardBackground = () => {
    return 'bg-bg-card/80';
  };

  const getTextColor = () => {
    return 'text-text-primary';
  };

  const getSecondaryTextColor = () => {
    return 'text-text-secondary';
  };

  const getDetailsBgColor = () => {
    return 'bg-bg-elevated/70';
  };

  const getDetailTextColor = () => {
    return 'text-text-secondary';
  };

  const getFilterButtonColor = (isActive: boolean, category: string) => {
    if (!isActive) {
      return 'bg-transparent border border-white/15 hover:border-white/30 text-text-secondary';
    }

    const colorMap: Record<string, string> = {
      all: 'bg-accent-amber text-bg-base',
      badges: 'bg-accent-teal text-bg-base',
      messages: 'bg-accent-amber text-bg-base',
      achievements: 'bg-accent-teal text-bg-base',
      updates: 'bg-accent-amber text-bg-base'
    };

    return colorMap[category] || 'bg-bg-elevated text-text-primary';
  };

  const handlePrimaryAction = (notification: Notification) => {
    if (notification.href) {
      navigate(notification.href);
    } else {
      switch (notification.category) {
        case 'badges':
          navigate('/certificates');
          break;
        case 'messages':
          navigate('/messages');
          break;
        case 'achievements':
          navigate('/profile');
          break;
        case 'updates':
          navigate('/dashboard');
          break;
        default:
          navigate('/');
      }
    }
  };

  const handleSecondaryAction = (notification: Notification) => {
    if (notification.secondaryAction === 'Reply') {
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      navigate('/messages');
      return;
    }

    if (notification.secondaryAction === 'Dismiss') {
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      return;
    }

    console.log(`Action: ${notification.secondaryAction}`);
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-bg-base">
      <div className={`max-w-6xl mx-auto px-4 py-8 pt-24 ${getTextColor()}`}>
        <div className="pointer-events-none absolute -top-8 right-6 w-56 h-56 rounded-full bg-[radial-gradient(circle,rgba(73,220,122,0.12),transparent_70%)]" />
        {/* Back Button */}
        <button
          onClick={() => navigate('/feed')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <div className="mb-8 pb-6 border-b border-white/5 text-center">
          <h1 className={`text-4xl font-bold mb-2 ${getTextColor()}`}>Notifications</h1>
          <p className={getSecondaryTextColor()}>Stay updated with your learning progress, achievements, and messages</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              getFilterButtonColor(activeFilter === 'all', 'all')
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('badges')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              getFilterButtonColor(activeFilter === 'badges', 'badges')
            }`}
          >
            Badges & Certificates
          </button>
          <button
            onClick={() => setActiveFilter('messages')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              getFilterButtonColor(activeFilter === 'messages', 'messages')
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveFilter('achievements')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              getFilterButtonColor(activeFilter === 'achievements', 'achievements')
            }`}
          >
            Achievements
          </button>
          <button
            onClick={() => setActiveFilter('updates')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              getFilterButtonColor(activeFilter === 'updates', 'updates')
            }`}
          >
            Updates
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 border rounded-2xl text-center transition-all duration-300 bg-bg-card/70 border-white/10 hover:border-accent-teal/60">
            <div className="text-3xl font-bold mb-2 text-accent-teal">{notifications.length}</div>
            <div className="text-sm uppercase tracking-wider text-text-secondary">Badges & Certificates</div>
          </div>
          <div className="p-5 border rounded-2xl text-center transition-all duration-300 bg-bg-card/70 border-white/10 hover:border-accent-amber/60">
            <div className="text-3xl font-bold mb-2 text-accent-amber">{notifications.filter(n => n.category === 'badges').length}</div>
            <div className="text-sm uppercase tracking-wider text-text-secondary">Messages</div>
          </div>
          <div className="p-5 border rounded-2xl text-center transition-all duration-300 bg-bg-card/70 border-white/10 hover:border-accent-teal/60">
            <div className="text-3xl font-bold mb-2 text-accent-teal">{notifications.filter(n => n.category === 'achievements').length}</div>
            <div className="text-sm uppercase tracking-wider text-text-secondary">Achievements</div>
          </div>
        </div>

        {/* Notifications Grid */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[400px] border rounded-3xl animate-pulse transition-colors duration-300 bg-bg-card/70 border-white/10" />
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 border rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${getCardBorderColor(notification.category)} ${getCardBackground()}`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-1 ${getTextColor()}`}>{notification.title}</h3>
                    <p className={`text-xs ${getSecondaryTextColor()}`}>{notification.time}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${getBadgeColor(notification.category)}`}>
                    {notification.icon}
                  </div>
                </div>

                {/* Description */}
                <p className={`text-sm mb-4 leading-relaxed ${getSecondaryTextColor()}`}>
                  {notification.description}
                </p>

                {/* Details Card */}
                <div className={`p-4 rounded-lg mb-4 space-y-3 ${getDetailsBgColor()}`}>
                  {Object.entries(notification.details).map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className={`text-xs font-medium uppercase ${getDetailTextColor()}`}>{label}</span>
                      <span className={`text-sm font-semibold ${getTextColor()}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button 
                    onClick={() => handlePrimaryAction(notification)}
                    className="w-full py-2.5 font-semibold rounded-lg transition-colors duration-300 bg-accent-teal hover:bg-accent-amber text-bg-base shadow-[0_10px_24px_rgba(73,220,122,0.22)]"
                  >
                    {notification.primaryAction}
                  </button>
                  <button 
                    onClick={() => handleSecondaryAction(notification)}
                    className="w-full py-2.5 font-semibold rounded-lg transition-colors duration-300 bg-transparent border border-white/15 hover:border-white/30 text-text-primary"
                  >
                    {notification.secondaryAction}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-bg-card/70 rounded-xl border border-white/10">
            <div className={`text-5xl mb-4 opacity-50`}>📭</div>
            <h3 className={`text-xl font-semibold mb-2 ${getTextColor()}`}>No notifications</h3>
            <p className={getSecondaryTextColor()}>You're all caught up! Check back later for updates.</p>
          </div>
        )}
      </div>
    </div>
  );
}
