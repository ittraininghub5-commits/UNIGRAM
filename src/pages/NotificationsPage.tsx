import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { Profile } from '@/src/types';
import { useTheme } from '@/src/context/ThemeContext';
import { toast } from 'sonner';
import {
  createSynapseDeclineMessage,
  isSynapseConnectDecline,
  isSynapseConnectRequest,
  isSynapseThreadAccepted,
  SynapseThreadMessage,
} from '@/src/lib/synapse';

interface Notification {
  id: string;
  category: 'badges' | 'messages' | 'achievements' | 'connect';
  title: string;
  description: string;
  time: string;
  icon: string;
  details: Record<string, string>;
  primaryAction: string;
  secondaryAction: string;
  type?: 'message' | 'certificate' | 'enrollment' | 'follow' | 'connect';
  createdAt?: string;
  href?: string;
  messageId?: string;
  fromId?: string;
  fromName?: string;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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

        const { data: allThreadMessages } = await supabase
          .from('messages')
          .select('from_id, to_id, content, created_at')
          .or(`from_id.eq.${user.id},to_id.eq.${user.id}`)
          .order('created_at', { ascending: true })
          .limit(300);

        const threadMessagesByPartner = new Map<string, SynapseThreadMessage[]>();
        (allThreadMessages || []).forEach((row: any) => {
          const partnerId = row.from_id === user.id ? row.to_id : row.from_id;
          if (!partnerId) return;
          const existing = threadMessagesByPartner.get(partnerId) || [];
          existing.push({
            fromId: row.from_id,
            toId: row.to_id,
            content: row.content || '',
            createdAt: row.created_at,
          });
          threadMessagesByPartner.set(partnerId, existing);
        });

        const blockedPartnerIds = new Set<string>();
        threadMessagesByPartner.forEach((messages, partnerId) => {
          if (messages.some((message) => isSynapseConnectDecline(message.content))) {
            blockedPartnerIds.add(partnerId);
          }
        });

        const { data: messagesData } = await supabase
          .from('messages')
          .select('id, content, from_id, created_at, from:profiles!messages_from_id_fkey(full_name, role)')
          .eq('to_id', user.id)
          .order('created_at', { ascending: false })
          .limit(24);

        (messagesData || []).forEach((row: any) => {
          if (blockedPartnerIds.has(row.from_id)) {
            return;
          }

          const isConnect = isSynapseConnectRequest(row.content);
          const isDecline = isSynapseConnectDecline(row.content);
          const partnerThreadMessages = threadMessagesByPartner.get(row.from_id) || [];
          const canAppearInMessages =
            row.from?.role === 'mentor' || isSynapseThreadAccepted(user.id, row.from_id, partnerThreadMessages);

          if (isDecline) {
            return;
          }

          if (!isConnect && !canAppearInMessages) {
            return;
          }

          notificationList.push({
            id: `msg-${row.id}`,
            category: isConnect ? 'connect' : 'messages',
            title: isConnect
              ? `Collab request from ${row.from?.full_name || 'A collaborator'}`
              : `Message from ${row.from?.full_name || 'Instructor'}`,
            description: row.content || 'You have a new message.',
            time: new Date(row.created_at).toLocaleDateString(),
            icon: isConnect ? '🤝' : '💬',
            details: {
              From: row.from?.full_name || 'Instructor',
              Date: new Date(row.created_at).toLocaleDateString(),
            },
            primaryAction: isConnect ? 'Open Request' : 'Read Message',
            secondaryAction: isConnect ? 'Decline' : 'Reply',
            type: isConnect ? 'connect' : 'message',
            createdAt: row.created_at,
            href: `/messages?thread=${row.from_id}`,
            messageId: row.id,
            fromId: row.from_id,
            fromName: row.from?.full_name || 'there',
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
            const statusLabel =
              row.status === 'approved' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'pending';
            notificationList.push({
              id: `cert-${row.id}`,
              category: 'badges',
              title: `Certificate ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
              description: row.mentor_notes || `Course: ${row.course?.title || 'Your course'}`,
              time: new Date(row.reviewed_at || row.requested_at).toLocaleDateString(),
              icon: statusLabel === 'approved' ? '📜' : '⏳',
              details: {
                Course: row.course?.title || 'Your course',
                Status: statusLabel.toUpperCase(),
              },
              primaryAction: statusLabel === 'approved' ? 'Download Certificate' : 'View Details',
              secondaryAction: 'View Credentials',
              type: 'certificate',
              createdAt: row.reviewed_at || row.requested_at,
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
            notificationList.push({
              id: `approval-${row.id}`,
              category: 'badges',
              title: 'Certificate approval pending',
              description: `${row.student?.full_name || 'Student'} requested approval for ${row.course?.title || 'a course'}`,
              time: new Date(row.requested_at).toLocaleDateString(),
              icon: '📋',
              details: {
                Student: row.student?.full_name || 'Student',
                Course: row.course?.title || 'Course',
              },
              primaryAction: 'Review Request',
              secondaryAction: 'Dismiss',
              type: 'certificate',
              createdAt: row.requested_at,
              href: '/dashboard',
            });
          });
        }

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
                Follower: row.follower?.full_name || 'A student',
                Date: new Date(row.created_at).toLocaleDateString(),
              },
              primaryAction: 'View Profile',
              secondaryAction: 'Send Message',
              type: 'follow',
              createdAt: row.created_at,
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
              notificationList.push({
                id: `enroll-${row.id}`,
                category: 'connect',
                title: 'New enrollment',
                description: `${row.student?.full_name || 'A student'} enrolled in ${row.course?.title || 'your course'}`,
                time: new Date(row.enrolled_at).toLocaleDateString(),
                icon: '🎓',
                details: {
                  Student: row.student?.full_name || 'Student',
                  Course: row.course?.title || 'Course',
                },
                primaryAction: 'View Course',
                secondaryAction: 'Send Welcome',
                type: 'enrollment',
                createdAt: row.enrolled_at,
                href: '/dashboard',
              });
            });
        }

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

  const filteredNotifications =
    activeFilter === 'all' ? notifications : notifications.filter((n) => n.category === activeFilter);

  const getBadgeColor = (category: string) => {
    switch (category) {
      case 'badges':
        return theme === 'dark' ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700';
      case 'messages':
        return theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700';
      case 'achievements':
        return theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700';
      case 'connect':
        return theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700';
      default:
        return theme === 'dark' ? 'bg-gray-500/15 text-gray-300' : 'bg-gray-100 text-gray-700';
    }
  };

  const getCardBorderColor = (category: string) => {
    switch (category) {
      case 'badges':
        return theme === 'dark' ? 'border-teal-600/30 hover:border-teal-500' : 'border-teal-200 hover:border-teal-300';
      case 'messages':
        return theme === 'dark' ? 'border-blue-600/30 hover:border-blue-500' : 'border-blue-200 hover:border-blue-300';
      case 'achievements':
        return theme === 'dark' ? 'border-purple-600/30 hover:border-purple-500' : 'border-purple-200 hover:border-purple-300';
      case 'connect':
        return theme === 'dark' ? 'border-amber-600/30 hover:border-amber-500' : 'border-amber-200 hover:border-amber-300';
      default:
        return theme === 'dark' ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300';
    }
  };

  const getCardBackground = () => (theme === 'dark' ? 'bg-slate-800/50' : 'bg-white');
  const getTextColor = () => (theme === 'dark' ? 'text-white' : 'text-slate-900');
  const getSecondaryTextColor = () => (theme === 'dark' ? 'text-slate-400' : 'text-slate-600');
  const getDetailsBgColor = () => (theme === 'dark' ? 'bg-slate-900/70' : 'bg-slate-100');
  const getDetailTextColor = () => (theme === 'dark' ? 'text-slate-400' : 'text-slate-600');

  const getFilterButtonColor = (isActive: boolean, category: string) => {
    if (!isActive) {
      return theme === 'dark'
        ? 'bg-transparent border border-slate-600 hover:border-slate-500'
        : 'bg-transparent border border-slate-300 hover:border-slate-400';
    }

    const colorMap: Record<string, { dark: string; light: string }> = {
      all: { dark: 'bg-cyan-500 text-slate-950', light: 'bg-cyan-400 text-white' },
      badges: { dark: 'bg-teal-500 text-slate-950', light: 'bg-teal-500 text-white' },
      messages: { dark: 'bg-blue-500 text-slate-950', light: 'bg-blue-500 text-white' },
      achievements: { dark: 'bg-purple-500 text-white', light: 'bg-purple-500 text-white' },
      connect: { dark: 'bg-amber-500 text-slate-950', light: 'bg-amber-500 text-white' },
    };

    return theme === 'dark' ? colorMap[category]?.dark : colorMap[category]?.light;
  };

  const handlePrimaryAction = (notification: Notification) => {
    if (notification.href) {
      navigate(notification.href);
      return;
    }

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
      case 'connect':
        navigate('/messages');
        break;
      default:
        navigate('/');
    }
  };

  const handleSecondaryAction = async (notification: Notification) => {
    if (notification.type === 'connect' && notification.messageId && notification.fromId && profile?.id) {
      try {
        const declineMessage = createSynapseDeclineMessage(notification.fromName);

        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .eq('id', notification.messageId)
          .eq('to_id', profile.id);

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            from_id: profile.id,
            to_id: notification.fromId,
            content: declineMessage,
          });

        if (insertError) throw insertError;

        setNotifications((prev) => prev.filter((item) => item.id !== notification.id && item.fromId !== notification.fromId));
        toast.success('Collab request declined. Chat is now locked for both users.');
        return;
      } catch (error: any) {
        console.error('Failed to decline collab request:', error);
        toast.error(error?.message || 'Unable to decline this collab request.');
        return;
      }
    }

    if (notification.type === 'message' && notification.href) {
      navigate(notification.href);
      return;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`max-w-6xl mx-auto px-4 py-8 pt-24 ${getTextColor()}`}>
        <button
          onClick={() => navigate('/feed')}
          className={`mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
            theme === 'dark'
              ? 'border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
              : 'border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className={`mb-8 pb-6 border-b transition-colors duration-300 ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'} text-center`}>
          <h1 className={`text-4xl font-bold mb-2 ${getTextColor()}`}>Notifications</h1>
          <p className={getSecondaryTextColor()}>
            Stay updated with your learning progress, achievements, messages, and Collab requests
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setActiveFilter('all')} className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${getFilterButtonColor(activeFilter === 'all', 'all')}`}>All</button>
          <button onClick={() => setActiveFilter('badges')} className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${getFilterButtonColor(activeFilter === 'badges', 'badges')}`}>Badges & Certificates</button>
          <button onClick={() => setActiveFilter('messages')} className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${getFilterButtonColor(activeFilter === 'messages', 'messages')}`}>Messages</button>
          <button onClick={() => setActiveFilter('achievements')} className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${getFilterButtonColor(activeFilter === 'achievements', 'achievements')}`}>Achievements</button>
          <button onClick={() => setActiveFilter('connect')} className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${getFilterButtonColor(activeFilter === 'connect', 'connect')}`}>Collab</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatsCard theme={theme} color="teal" value={notifications.filter((n) => n.category === 'badges').length} label="Badges & Certificates" />
          <StatsCard theme={theme} color="blue" value={notifications.filter((n) => n.category === 'messages').length} label="Messages" />
          <StatsCard theme={theme} color="purple" value={notifications.filter((n) => n.category === 'achievements').length} label="Achievements" />
          <StatsCard theme={theme} color="amber" value={notifications.filter((n) => n.category === 'connect').length} label="Collab" />
        </div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-[400px] border rounded-3xl animate-pulse transition-colors duration-300 ${
                  theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-200 border-slate-300'
                }`}
              />
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 border rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${getCardBorderColor(notification.category)} ${getCardBackground()}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-1 ${getTextColor()}`}>{notification.title}</h3>
                    <p className={`text-xs ${getSecondaryTextColor()}`}>{notification.time}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${getBadgeColor(notification.category)}`}>
                    {notification.icon}
                  </div>
                </div>

                <p className={`text-sm mb-4 leading-relaxed ${getSecondaryTextColor()}`}>{notification.description}</p>

                <div className={`p-4 rounded-lg mb-4 space-y-3 ${getDetailsBgColor()}`}>
                  {Object.entries(notification.details).map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center gap-4">
                      <span className={`text-xs font-medium uppercase ${getDetailTextColor()}`}>{label}</span>
                      <span className={`text-sm font-semibold text-right ${getTextColor()}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handlePrimaryAction(notification)}
                    className={`w-full py-2.5 font-semibold rounded-lg transition-colors duration-300 ${
                      theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950' : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                    }`}
                  >
                    {notification.primaryAction}
                  </button>
                  <button
                    onClick={() => void handleSecondaryAction(notification)}
                    className={`w-full py-2.5 font-semibold rounded-lg transition-colors duration-300 ${
                      theme === 'dark'
                        ? 'bg-transparent border border-slate-600 hover:bg-slate-700 text-white'
                        : 'bg-transparent border border-slate-300 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    {notification.secondaryAction}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-12 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'} rounded-xl border ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
            <div className="text-5xl mb-4 opacity-50">📭</div>
            <h3 className={`text-xl font-semibold mb-2 ${getTextColor()}`}>No notifications</h3>
            <p className={getSecondaryTextColor()}>You're all caught up! Check back later for new activity.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  theme,
  color,
  value,
  label,
}: {
  theme: string;
  color: 'teal' | 'blue' | 'purple' | 'amber';
  value: number;
  label: string;
}) {
  const palette = {
    teal:
      theme === 'dark'
        ? 'bg-gradient-to-br from-teal-900/40 to-teal-800/20 border-teal-600/30 hover:border-teal-500 text-teal-400'
        : 'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200 hover:border-teal-300 text-teal-600',
    blue:
      theme === 'dark'
        ? 'bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-600/30 hover:border-blue-500 text-blue-400'
        : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300 text-blue-600',
    purple:
      theme === 'dark'
        ? 'bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-600/30 hover:border-purple-500 text-purple-400'
        : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300 text-purple-600',
    amber:
      theme === 'dark'
        ? 'bg-gradient-to-br from-amber-900/40 to-amber-800/20 border-amber-600/30 hover:border-amber-500 text-amber-400'
        : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:border-amber-300 text-amber-600',
  };

  return (
    <div className={`p-5 border rounded-xl text-center hover:shadow-md transition-all duration-300 ${palette[color]}`}>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className={`text-sm uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>{label}</div>
    </div>
  );
}
