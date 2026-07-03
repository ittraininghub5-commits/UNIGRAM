import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Profile } from '@/src/types';
import { cn, getInitials } from '@/src/lib/utils';
import { Send, Search, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { createNotification } from '@/src/services/notificationService';

const THREAD_INDEX_LIMIT = 200;
const CONVERSATION_LIMIT = 100;

interface Thread {
  id: string;
  name: string;
  avatarUrl?: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  color: string;
  lastTimestamp: number;
}

interface UiMessage {
  id: string;
  text: string;
  time: string;
  fromMe: boolean;
}

interface DbMessage {
  id: string;
  from_id: string;
  to_id: string;
  content: string | null;
  read: boolean;
  created_at: string;
}

const THREAD_COLORS = [
  'bg-[rgba(var(--accent-rgb),0.18)] text-accent-teal border border-[rgba(var(--accent-rgb),0.24)]',
  'bg-[rgba(var(--accent-secondary-rgb),0.18)] text-accent-amber border border-[rgba(var(--accent-secondary-rgb),0.24)]',
  'bg-[rgba(var(--accent-tertiary-rgb),0.18)] text-accent-purple border border-[rgba(var(--accent-tertiary-rgb),0.24)]',
  'bg-[linear-gradient(135deg,rgba(var(--accent-rgb),0.16)_0%,rgba(var(--accent-secondary-rgb),0.12)_100%)] text-accent-teal border border-[rgba(var(--accent-rgb),0.22)]',
];

interface MessagesPageProps {
  profile: Profile | null;
}

export default function MessagesPage({ profile }: MessagesPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversationByThread, setConversationByThread] = useState<Record<string, UiMessage[]>>({});
  const [blockedThreads, setBlockedThreads] = useState<Record<string, { blockedByMe: boolean; blockedByThem: boolean }>>({});
  const [loadingConversation, setLoadingConversation] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const profileIdRef = useRef<string | null>(null);
  profileIdRef.current = profile?.id ?? null;

  // Persist deleted thread IDs in sessionStorage so they survive page refreshes
  const deletedThreadIds = useRef<Set<string>>(new Set(
    JSON.parse(sessionStorage.getItem('deletedThreadIds') || '[]')
  ));

  const persistDeletedThreadId = useCallback((threadId: string) => {
    deletedThreadIds.current.add(threadId);
    sessionStorage.setItem('deletedThreadIds', JSON.stringify([...deletedThreadIds.current]));
  }, []);

  const preferredThreadId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('thread');
  }, [location.search]);

  const buildThreadsFromMessages = useCallback((
    allMessages: DbMessage[],
    profilesMap: Map<string, Profile>,
    userId: string,
  ) => {
    const conversations: Record<string, UiMessage[]> = {};
    const threadsMap = new Map<string, Thread>();

    allMessages.forEach((msg) => {
      const partnerId = msg.from_id === userId ? msg.to_id : msg.from_id;
      if (!partnerId) return;

      if (!conversations[partnerId]) {
        conversations[partnerId] = [];
      }

      conversations[partnerId].push(dbToUi(msg, userId));

      const partner = profilesMap.get(partnerId);
      const existing = threadsMap.get(partnerId);
      const unreadIncrement = msg.to_id === userId && !msg.read ? 1 : 0;
      const threadName = partner?.full_name || 'Unknown User';
      const color = THREAD_COLORS[Math.abs(hashString(partnerId)) % THREAD_COLORS.length];

      if (!existing) {
        threadsMap.set(partnerId, {
          id: partnerId,
          name: threadName,
          avatarUrl: partner?.avatar_url || null,
          lastMessage: msg.content || '',
          time: formatRelativeTime(msg.created_at),
          unread: unreadIncrement,
          color,
          lastTimestamp: new Date(msg.created_at).getTime(),
        });
      } else {
        existing.lastMessage = msg.content || existing.lastMessage;
        existing.time = formatRelativeTime(msg.created_at);
        existing.unread += unreadIncrement;
        existing.lastTimestamp = Math.max(existing.lastTimestamp, new Date(msg.created_at).getTime());
      }
    });

    return {
      conversations,
      threads: Array.from(threadsMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp),
    };
  }, []);

  const loadBlockedStates = useCallback(async () => {
    if (!profile?.id) return {} as Record<string, { blockedByMe: boolean; blockedByThem: boolean }>;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`);

      if (error) throw error;

      const states: Record<string, { blockedByMe: boolean; blockedByThem: boolean }> = {};
      (data || []).forEach((row: { blocker_id: string; blocked_id: string }) => {
        if (row.blocker_id === profile.id) {
          states[row.blocked_id] = { blockedByMe: true, blockedByThem: false };
        }
        if (row.blocked_id === profile.id) {
          states[row.blocker_id] = { blockedByMe: false, blockedByThem: true };
        }
      });

      setBlockedThreads(states);
      return states;
    } catch (err) {
      console.error('Error loading blocked states:', err);
      return {} as Record<string, { blockedByMe: boolean; blockedByThem: boolean }>;
    }
  }, [profile?.id]);

  const loadThreadIndex = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id, from_id, to_id, content, read, created_at')
        .or(`from_id.eq.${profile.id},to_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(THREAD_INDEX_LIMIT);

      if (error) throw error;

      const allMessages = ((data || []) as DbMessage[]).slice().reverse();
      const participantIds = Array.from(new Set(allMessages
        .map((m) => (m.from_id === profile.id ? m.to_id : m.from_id))
        .filter(Boolean)));

      const profilesMap = new Map<string, Profile>();
      if (participantIds.length > 0) {
        const { data: participantProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', participantIds);

        (participantProfiles || []).forEach((p: { id: string; full_name: string; avatar_url: string | null }) => profilesMap.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          email: '',
          username: '',
          role: 'student',
          bio: '',
          institution: '',
          phone: '',
          is_verified: false,
          followers_count: 0,
          following_count: 0,
          created_at: new Date().toISOString(),
        } as Profile));
      }

      const blockedStates: Record<string, { blockedByMe: boolean; blockedByThem: boolean }> = {};
      if (participantIds.length > 0) {
        const { data: blockedData, error: blockedError } = await supabase
          .from('blocked_users')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`);

        if (!blockedError && blockedData) {
          (blockedData as Array<{ blocker_id: string; blocked_id: string }>).forEach((row) => {
            if (row.blocker_id === profile.id) {
              blockedStates[row.blocked_id] = { blockedByMe: true, blockedByThem: false };
            }
            if (row.blocked_id === profile.id) {
              blockedStates[row.blocker_id] = { blockedByMe: false, blockedByThem: true };
            }
          });
        }
      }

      const { conversations, threads } = buildThreadsFromMessages(allMessages, profilesMap, profile.id);

      setConversationByThread((prev) => {
        const merged = { ...prev };
        Object.entries(conversations).forEach(([threadId, preview]) => {
          if (!merged[threadId]?.length) {
            merged[threadId] = preview;
          }
        });
        return merged;
      });
      setBlockedThreads(blockedStates);
      setThreads(threads.filter((t) => !deletedThreadIds.current.has(t.id)));
      setSelectedThreadId((prev) => {
        if (prev && deletedThreadIds.current.has(prev)) return null;
        return preferredThreadId || prev || threads.filter((t) => !deletedThreadIds.current.has(t.id))[0]?.id || null;
      });
    } catch (err) {
      console.error('Error loading message threads:', err);
      toast.error('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, preferredThreadId, buildThreadsFromMessages]);

  const loadThreadConversation = useCallback(async (threadId: string, silent = false) => {
    if (!profile?.id) return;

    try {
      if (!silent) setLoadingConversation(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id, from_id, to_id, content, read, created_at')
        .or(
          `and(from_id.eq.${profile.id},to_id.eq.${threadId}),and(from_id.eq.${threadId},to_id.eq.${profile.id})`,
        )
        .order('created_at', { ascending: true })
        .limit(CONVERSATION_LIMIT);

      if (error) throw error;

      const messages = ((data || []) as DbMessage[]).map((msg) => dbToUi(msg, profile.id));
      setConversationByThread((prev) => ({ ...prev, [threadId]: messages }));
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`);

      if (!blockedError && blockedData) {
        const blockedStates: Record<string, { blockedByMe: boolean; blockedByThem: boolean }> = {};
        (blockedData as Array<{ blocker_id: string; blocked_id: string }>).forEach((row) => {
          if (row.blocker_id === profile.id) {
            blockedStates[row.blocked_id] = { blockedByMe: true, blockedByThem: false };
          }
          if (row.blocked_id === profile.id) {
            blockedStates[row.blocker_id] = { blockedByMe: false, blockedByThem: true };
          }
        });
        setBlockedThreads(blockedStates);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
      toast.error('Failed to load conversation.');
    } finally {
      if (!silent) setLoadingConversation(false);
    }
  }, [profile?.id]);

  const applyIncomingMessage = useCallback((msg: DbMessage) => {
    const userId = profileIdRef.current;
    if (!userId) return;

    const partnerId = msg.from_id === userId ? msg.to_id : msg.from_id;
    if (!partnerId) return;

    // Don't apply messages from deleted/blocked threads
    if (deletedThreadIds.current.has(partnerId)) return;

    setConversationByThread((prev) => {
      const existing = prev[partnerId] || [];
      if (existing.some((item) => item.id === msg.id)) return prev;
      return { ...prev, [partnerId]: [...existing, dbToUi(msg, userId)] };
    });

    setThreads((prev) => {
      const color = THREAD_COLORS[Math.abs(hashString(partnerId)) % THREAD_COLORS.length];
      const unreadIncrement = msg.to_id === userId && !msg.read ? 1 : 0;
      const existing = prev.find((thread) => thread.id === partnerId);

      if (!existing) {
        void supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', partnerId)
          .maybeSingle()
          .then(({ data }) => {
            const name = data?.full_name || 'Unknown User';
            setThreads((current) => {
              if (current.some((thread) => thread.id === partnerId)) return current;
              return [
                {
                  id: partnerId,
                  name,
                  avatarUrl: data?.avatar_url || null,
                  lastMessage: msg.content || '',
                  time: formatRelativeTime(msg.created_at),
                  unread: unreadIncrement,
                  color,
                  lastTimestamp: new Date(msg.created_at).getTime(),
                },
                ...current,
              ].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            });
          });
        return prev;
      }

      return prev
        .map((thread) =>
          thread.id === partnerId
            ? {
                ...thread,
                lastMessage: msg.content || thread.lastMessage,
                time: formatRelativeTime(msg.created_at),
                unread:
                  msg.to_id === userId && !msg.read && selectedThreadIdRef.current !== partnerId
                    ? thread.unread + 1
                    : thread.unread,
                lastTimestamp: Math.max(thread.lastTimestamp, new Date(msg.created_at).getTime()),
              }
            : thread,
        )
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    });
  }, []);

  const selectedThreadIdRef = useRef<string | null>(null);
  selectedThreadIdRef.current = selectedThreadId;

  const markThreadAsRead = useCallback(async (threadId: string) => {
    if (!profile?.id) return;

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, unread: 0 } : thread
      )
    );

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('to_id', profile.id)
        .eq('from_id', threadId)
        .eq('read', false);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking messages as read:', err);
      void loadThreadIndex();
    }
  }, [profile?.id, loadThreadIndex]);

  const ensureThreadExists = useCallback(async (threadId: string) => {
    const exists = threads.some((thread) => thread.id === threadId);
    if (exists) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (error || !data) return;

    const color = THREAD_COLORS[Math.abs(hashString(threadId)) % THREAD_COLORS.length];
    setThreads((prev) => [
      {
        id: threadId,
        name: data.full_name || 'Unknown User',
        lastMessage: 'Start the conversation',
        time: 'now',
        unread: 0,
        color,
        lastTimestamp: Date.now(),
      },
      ...prev,
    ]);
  }, [threads]);

  const selectedThread = useMemo(() => {
    return threads.find((thread) => thread.id === selectedThreadId) || null;
  }, [threads, selectedThreadId]);

  const filteredThreads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => thread.name.toLowerCase().includes(query));
  }, [threads, searchTerm]);

  const selectedMessages = useMemo(() => {
    if (!selectedThreadId) return [];
    return conversationByThread[selectedThreadId] || [];
  }, [selectedThreadId, conversationByThread]);

  const selectedThreadBlockState = useMemo(() => {
    if (!selectedThreadId) return null;
    return blockedThreads[selectedThreadId] || null;
  }, [selectedThreadId, blockedThreads]);

  const lastMessageId = selectedMessages[selectedMessages.length - 1]?.id ?? null;

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior });
    }, 50);
  }, []);

  useEffect(() => {
    if (!lastMessageId) return;
    scrollToLatest('smooth');
  }, [lastMessageId, scrollToLatest]);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    void loadThreadIndex();

    const channel = supabase
      .channel(`messages-realtime-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `from_id=eq.${profile.id}` },
        (payload) => applyIncomingMessage(payload.new as DbMessage),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${profile.id}` },
        (payload) => applyIncomingMessage(payload.new as DbMessage),
      )
      .subscribe();

    const refreshInterval = window.setInterval(() => {
      void loadThreadIndex();
      if (selectedThreadId) {
        void loadThreadConversation(selectedThreadId, true);
      }
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(refreshInterval);
    };
  }, [profile?.id, loadThreadIndex, applyIncomingMessage, loadThreadConversation, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadThreadConversation(selectedThreadId);
  }, [selectedThreadId, loadThreadConversation]);

  // Auto-scroll to bottom when conversation loads
  useEffect(() => {
    if (loadingConversation || selectedMessages.length === 0) return;
    scrollToLatest('auto');
  }, [selectedThreadId, loadingConversation, selectedMessages.length, scrollToLatest]);

  useEffect(() => {

    const presenceChannel = supabase.channel(`messages-presence-${profile.id}`, {
      config: { presence: { key: profile.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set<string>(Object.keys(state || {}));
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await presenceChannel.track({ userId: profile.id, onlineAt: new Date().toISOString() });
          } catch (err) {
            console.error('[MessagesPage] presence track error', err);
          }
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !selectedThreadId) return;
    const selected = threads.find((thread) => thread.id === selectedThreadId);
    if (!selected || selected.unread === 0) return;
    void markThreadAsRead(selectedThreadId);
  }, [profile?.id, selectedThreadId, threads, markThreadAsRead]);

  useEffect(() => {
    if (!preferredThreadId) return;
    void ensureThreadExists(preferredThreadId);
    setSelectedThreadId(preferredThreadId);
  }, [preferredThreadId, ensureThreadExists]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDeleteChat = useCallback(async () => {
    if (!profile?.id || !selectedThreadId) return;
    const threadId = selectedThreadId;
    setMenuOpen(false);

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(
          `and(from_id.eq.${profile.id},to_id.eq.${threadId}),and(from_id.eq.${threadId},to_id.eq.${profile.id})`
        );

      if (error) {
        console.error('Delete error:', JSON.stringify(error));
        throw error;
      }

      // Persist deleted thread ID so page refreshes don't reload it
      persistDeletedThreadId(threadId);

      setConversationByThread((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setSelectedThreadId(null);
      toast.success('Chat deleted.');
    } catch (err) {
      console.error('Failed to delete chat:', err);
      toast.error('Failed to delete chat.');
    }
  }, [profile?.id, selectedThreadId, persistDeletedThreadId]);

  const handleBlockUser = useCallback(async () => {
    if (!profile?.id || !selectedThreadId) return;
    const threadId = selectedThreadId;
    setMenuOpen(false);

    try {
      const { error: blockError } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: profile.id, blocked_id: threadId });

      if (blockError) {
        console.error('Block error:', JSON.stringify(blockError));
        throw blockError;
      }

      setBlockedThreads((prev) => ({
        ...prev,
        [threadId]: { blockedByMe: true, blockedByThem: false },
      }));

<<<<<<< HEAD
      if (deleteError) {
        console.error('Delete after block error:', JSON.stringify(deleteError));
        // Non-fatal — user is still blocked even if message cleanup fails
      }

      // Persist deleted thread ID so page refreshes don't reload it
      persistDeletedThreadId(threadId);

      setConversationByThread((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setSelectedThreadId(null);
=======
>>>>>>> a7fc9385c800fd70c6c2e9625790da2dd6f628dc
      toast.success('User blocked.');
    } catch (err) {
      console.error('Failed to block user:', err);
      toast.error('Failed to block user.');
    }
  }, [profile?.id, selectedThreadId, persistDeletedThreadId]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !profile?.id || !selectedThreadId) return;

    const blockState = blockedThreads[selectedThreadId];
    if (blockState?.blockedByMe) {
      toast.error('You have blocked this user. Unblock to send messages.');
      return;
    }
    if (blockState?.blockedByThem) {
      toast.error('You have been blocked by this user. You cannot send messages.');
      return;
    }

    const threadId = selectedThreadId;
    const { data: blockData, error: blockDataError } = await supabase
      .from('blocked_users')
      .select('blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${profile.id},blocked_id.eq.${threadId}),and(blocker_id.eq.${threadId},blocked_id.eq.${profile.id})`,
      );

    if (!blockDataError && blockData) {
      const blockedByMe = blockData.some((row: { blocker_id: string; blocked_id: string }) => row.blocker_id === profile.id && row.blocked_id === threadId);
      const blockedByThem = blockData.some((row: { blocker_id: string; blocked_id: string }) => row.blocker_id === threadId && row.blocked_id === profile.id);

      if (blockedByMe || blockedByThem) {
        setBlockedThreads((prev) => ({
          ...prev,
          [threadId]: { blockedByMe, blockedByThem },
        }));

        if (blockedByMe) {
          toast.error('You have blocked this user. Unblock to send messages.');
        } else {
          toast.error('You have been blocked by this user. You cannot send messages.');
        }
        return;
      }
    }

    const content = message.trim();
    const optimisticId = `pending-${Date.now()}`;
    setMessage('');

    setConversationByThread((prev) => ({
      ...prev,
      [threadId]: [
        ...(prev[threadId] || []),
        {
          id: optimisticId,
          text: content,
          time: formatMessageTime(new Date().toISOString()),
          fromMe: true,
        },
      ],
    }));

    setThreads((prev) =>
      prev
        .map((thread) =>
          thread.id === threadId
            ? { ...thread, lastMessage: content, time: 'now', lastTimestamp: Date.now() }
            : thread,
        )
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp),
    );

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ from_id: profile.id, to_id: threadId, content }])
        .select('id, from_id, to_id, content, read, created_at')
        .single();

      if (error) throw error;

      const saved = data as DbMessage;
      setConversationByThread((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] || [])
          .filter((item) => item.id !== optimisticId)
          .concat(dbToUi(saved, profile.id)),
      }));

      void createNotification({
        userId: threadId,
        type: 'message',
        title: 'New message',
        body: `${profile.full_name || 'Someone'} sent you a message`,
        href: `/messages?thread=${profile.id}`,
      });
    } catch (err) {
      console.error('Error sending message:', err);
      setConversationByThread((prev) => ({
        ...prev,
        [threadId]: (prev[threadId] || []).filter((item) => item.id !== optimisticId),
      }));
      toast.error('Failed to send message.');
      setMessage(content);
    }
  }, [message, profile, selectedThreadId, blockedThreads]);

  const handleUnblockUser = useCallback(async () => {
    if (!profile?.id || !selectedThreadId) return;
    setMenuOpen(false);

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .match({ blocker_id: profile.id, blocked_id: selectedThreadId });

      if (error) {
        console.error('Unblock error:', JSON.stringify(error));
        throw error;
      }

      setBlockedThreads((prev) => {
        const next = { ...prev };
        delete next[selectedThreadId];
        return next;
      });

      toast.success('User unblocked.');
    } catch (err) {
      console.error('Failed to unblock user:', err);
      toast.error('Failed to unblock user.');
    }
  }, [profile?.id, selectedThreadId]);

  return (
    <div className="pt-24 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr] h-[calc(100vh-12rem)] min-h-[480px] shadow-2xl">

        {/* Thread List */}
        <aside className="border-r border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Messages</h2>
              <button
                onClick={() => navigate('/search')}
                className="text-accent-teal hover:bg-accent-teal/10 p-2 rounded-xl transition-all"
              >
                <EditIcon />
              </button>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-teal transition-colors" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:border-accent-teal transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <div className="p-6 text-xs text-text-muted">Loading chats...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6 text-xs text-text-muted">No conversations found.</div>
            ) : filteredThreads.map((thread) => {
              const presence = getThreadPresence(thread, onlineUserIds);
              return (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={cn(
                    'w-full p-4 flex gap-4 items-center transition-all hover:bg-bg-elevated/50',
                    selectedThread?.id === thread.id ? 'bg-bg-elevated' : '',
                  )}
                >
                  <div className="relative shrink-0">
                    <div className={cn('w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm', thread.color)}>
                      {thread.avatarUrl ? (
                        <img
                          src={thread.avatarUrl}
                          alt={thread.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span style={{ display: thread.avatarUrl ? 'none' : 'flex' }}>
                        {getInitials(thread.name)}
                      </span>
                    </div>
                    {presence !== 'offline' && (
                      <div className={cn('absolute bottom-0 right-0 w-3 h-3 border-2 border-bg-card rounded-full', presence === 'online' ? 'bg-accent-teal' : 'bg-accent-amber')} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold truncate">{thread.name}</p>
                      <span className="text-[10px] text-text-muted font-mono">{thread.time}</span>
                    </div>
                    <p className="text-xs text-text-secondary truncate leading-relaxed">{thread.lastMessage}</p>
                  </div>
                  {thread.unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-accent-teal text-bg-base text-[10px] font-bold flex items-center justify-center">
                      {thread.unread}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex flex-col min-h-0 h-full bg-bg-base/30">
          {/* Header */}
          <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-bg-card/90">
            {(() => {
              const selectedPresence = selectedThread ? getThreadPresence(selectedThread, onlineUserIds) : 'offline';
              return (
                <div className="flex items-center gap-4">
                  <div className={cn('relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs', selectedThread?.color || THREAD_COLORS[0])}>
                    {selectedThread?.avatarUrl ? (
                      <img
                        src={selectedThread.avatarUrl}
                        alt={selectedThread.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span style={{ display: selectedThread?.avatarUrl ? 'none' : 'flex' }}>
                      {getInitials(selectedThread?.name || 'User')}
                    </span>
                    {selectedThread && selectedPresence !== 'offline' && (
                      <span className={cn('absolute bottom-0 right-0 w-2.5 h-2.5 border border-bg-card rounded-full', selectedPresence === 'online' ? 'bg-accent-teal' : 'bg-accent-amber')} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">{selectedThread?.name || 'No conversation selected'}</p>
                    <p className={cn('text-[10px] font-medium', selectedThread ? selectedPresence === 'online' ? 'text-accent-teal' : selectedPresence === 'recent' ? 'text-accent-amber' : 'text-text-muted' : 'text-text-muted')}>
                      {selectedThread ? selectedPresence === 'online' ? 'Online' : selectedPresence === 'recent' ? 'Recently Active' : 'Offline' : 'Messages'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Three-dot menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && selectedThread && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-card border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => { setMenuOpen(false); navigate(`/profile/${selectedThread.id}`); }}
                    className="w-full px-4 py-3 text-sm text-left text-text-primary hover:bg-bg-elevated transition-all flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    View Profile
                  </button>
                  <div className="h-px bg-white/5" />
                  <button
                    onClick={handleDeleteChat}
                    className="w-full px-4 py-3 text-sm text-left text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Delete Chat
                  </button>
                  <div className="h-px bg-white/5" />
                  <button
                    onClick={selectedThreadBlockState?.blockedByMe ? handleUnblockUser : handleBlockUser}
                    className="w-full px-4 py-3 text-sm text-left text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-3"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    {selectedThreadBlockState?.blockedByMe ? 'Unblock User' : 'Block User'}
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col"
            onScroll={(e) => {
              const el = e.currentTarget;
              isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
            }}
          >
            <div className="flex flex-col gap-6">
              {selectedThreadBlockState?.blockedByMe ? (
                <div className="sticky top-0 z-10 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  You have blocked this user. Use the menu to unblock them if you want to resume messaging.
                </div>
              ) : selectedThreadBlockState?.blockedByThem ? (
                <div className="sticky top-0 z-10 rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  You have been blocked by this user. You cannot send messages. 
                  <span className="block font-semibold">You have been blocked.</span>
                </div>
              ) : null}

              {!selectedThread ? (
                <div className="text-sm text-text-muted">Select a conversation to start chatting.</div>
              ) : loadingConversation ? (
                <div className="text-sm text-text-muted">Loading conversation...</div>
              ) : selectedMessages.length === 0 ? (
                <div className="text-sm text-text-muted">No messages yet. Say hello.</div>
              ) : selectedMessages.map((msg) => (
                <div key={msg.id} className={cn('flex gap-3 max-w-[80%]', msg.fromMe ? 'ml-auto flex-row-reverse' : '')}>
                  {!msg.fromMe && (
                    <div className={cn('w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] shrink-0 mt-auto', selectedThread.color)}>
                      {selectedThread.avatarUrl ? (
                        <img
                          src={selectedThread.avatarUrl}
                          alt={selectedThread.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span style={{ display: selectedThread.avatarUrl ? 'none' : 'flex' }}>
                        {getInitials(selectedThread.name)}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className={cn(
                      'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                      msg.fromMe
                        ? 'bg-accent-teal/10 border border-accent-teal/20 text-text-primary rounded-br-none'
                        : 'bg-bg-elevated text-text-secondary rounded-bl-none',
                    )}>
                      {msg.text}
                    </div>
                    <p className={cn('text-[9px] font-mono text-text-muted', msg.fromMe ? 'text-right' : '')}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <footer className="p-6 bg-bg-card/90 border-t border-white/5">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={!selectedThread}
                className="flex-1 bg-bg-elevated border border-white/5 rounded-2xl px-6 py-3 text-sm outline-none focus:border-accent-teal transition-all"
              />
              <button
                type="submit"
                disabled={!selectedThread || !message.trim() || selectedThreadBlockState?.blockedByMe || selectedThreadBlockState?.blockedByThem}
                className="bg-accent-teal hover:brightness-110 text-bg-base p-3 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </footer>
        </div>

      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function dbToUi(msg: DbMessage, profileId: string): UiMessage {
  return {
    id: msg.id,
    text: msg.content || '',
    time: formatMessageTime(msg.created_at),
    fromMe: msg.from_id === profileId,
  };
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function formatMessageTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getThreadPresence(thread: Thread, onlineUserIds: Set<string>): 'online' | 'recent' | 'offline' {
  if (onlineUserIds.has(thread.id)) return 'online';
  const diffMs = Date.now() - thread.lastTimestamp;
  if (diffMs < 2 * 60 * 1000) return 'recent';
  if (diffMs < 15 * 60 * 1000) return 'recent';
  return 'offline';
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}