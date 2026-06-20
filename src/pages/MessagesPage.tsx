import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Profile } from '@/src/types';
import { cn, getInitials } from '@/src/lib/utils';
import { Send, Search, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { createNotification } from '@/src/services/notificationService';
import {
  createSynapseAcceptMessage,
  createSynapseDeclineMessage,
  isSynapseConnectAccepted,
  isSynapseConnectDecline,
  isSynapseConnectRequest,
} from '@/src/lib/synapse';

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
  const [handlingCollabDecision, setHandlingCollabDecision] = useState(false);
  const [conversationByThread, setConversationByThread] = useState<Record<string, UiMessage[]>>({});
  const [loadingConversation, setLoadingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileIdRef = useRef<string | null>(null);
  profileIdRef.current = profile?.id ?? null;

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

        (participantProfiles || []).forEach((p: Profile) => profilesMap.set(p.id, p));
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
      setThreads(threads);
      setSelectedThreadId((prev) => preferredThreadId || prev || threads[0]?.id || null);
    } catch (err) {
      console.error('Error loading message threads:', err);
      toast.error('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, preferredThreadId, buildThreadsFromMessages]);

  const loadThreadConversation = useCallback(async (threadId: string) => {
    if (!profile?.id) return;

    try {
      setLoadingConversation(true);
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
    } catch (err) {
      console.error('Error loading conversation:', err);
      toast.error('Failed to load conversation.');
    } finally {
      setLoadingConversation(false);
    }
  }, [profile?.id]);

  const applyIncomingMessage = useCallback((msg: DbMessage) => {
    const userId = profileIdRef.current;
    if (!userId) return;

    const partnerId = msg.from_id === userId ? msg.to_id : msg.from_id;
    if (!partnerId) return;

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
    if (!profile?.id) {
      return;
    }

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
    if (exists) {
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (error || !data) {
      return;
    }

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
    if (!query) {
      return threads;
    }
    return threads.filter((thread) => thread.name.toLowerCase().includes(query));
  }, [threads, searchTerm]);

  const selectedMessages = useMemo(() => {
    if (!selectedThreadId) return [];
    return conversationByThread[selectedThreadId] || [];
  }, [selectedThreadId, conversationByThread]);

  const pendingIncomingCollabRequest = useMemo(() => {
    const hasIncomingRequest = selectedMessages.some(
      (item) => !item.fromMe && isSynapseConnectRequest(item.text),
    );
    const hasDecision = selectedMessages.some(
      (item) =>
        (item.fromMe && (isSynapseConnectAccepted(item.text) || isSynapseConnectDecline(item.text))) ||
        (!item.fromMe && (isSynapseConnectAccepted(item.text) || isSynapseConnectDecline(item.text))),
    );
    return hasIncomingRequest && !hasDecision;
  }, [selectedMessages]);

  const lastMessageId = selectedMessages[selectedMessages.length - 1]?.id ?? null;

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  useEffect(() => {
    scrollToLatest('auto');
  }, [selectedThreadId, scrollToLatest]);

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
        void loadThreadConversation(selectedThreadId);
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

  useEffect(() => {
    if (!profile?.id) {
      setOnlineUserIds(new Set());
      return;
    }

    const presenceChannel = supabase.channel(`messages-presence-${profile.id}`, {
      config: {
        presence: { key: profile.id },
      },
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
            await presenceChannel.track({
              userId: profile.id,
              onlineAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error('[MessagesPage] presence track error', err);
          }
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || !selectedThreadId) {
      return;
    }

    const selected = threads.find((thread) => thread.id === selectedThreadId);
    if (!selected || selected.unread === 0) {
      return;
    }

    void markThreadAsRead(selectedThreadId);
  }, [profile?.id, selectedThreadId, threads, markThreadAsRead]);

  useEffect(() => {
    if (!preferredThreadId) {
      return;
    }

    void ensureThreadExists(preferredThreadId);
    setSelectedThreadId(preferredThreadId);
  }, [preferredThreadId, ensureThreadExists]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !profile?.id || !selectedThreadId) return;
    if (pendingIncomingCollabRequest) {
      toast.info('Please accept or decline the collab request before sending another message.');
      return;
    }

    const content = message.trim();
    const threadId = selectedThreadId;
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
            ? {
                ...thread,
                lastMessage: content,
                time: 'now',
                lastTimestamp: Date.now(),
              }
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
  }, [message, pendingIncomingCollabRequest, profile, selectedThreadId]);

  const handleCollabDecision = useCallback(
    async (decision: 'accept' | 'decline') => {
      if (!profile?.id || !selectedThreadId || !selectedThread) return;

      setHandlingCollabDecision(true);
      try {
        const content =
          decision === 'accept'
            ? createSynapseAcceptMessage(profile.full_name)
            : createSynapseDeclineMessage(profile.full_name);

        const { error } = await supabase
          .from('messages')
          .insert({
            from_id: profile.id,
            to_id: selectedThreadId,
            content,
          });

        if (error) throw error;

        if (decision === 'accept') {
          toast.success('Collab request accepted — the chat is now open.');
        } else {
          toast.success('Your response has been sent.');
        }

        await loadThreadConversation(selectedThreadId);
      } catch (err) {
        console.error('Error handling collab response:', err);
        toast.error('Failed to send your response.');
      } finally {
        setHandlingCollabDecision(false);
      }
    },
    [loadThreadConversation, profile, selectedThread, selectedThreadId],
  );

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
            ) : filteredThreads.map((thread) => (
              (() => {
                const presence = getThreadPresence(thread, onlineUserIds);
                return (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={cn(
                  "w-full p-4 flex gap-4 items-center transition-all hover:bg-bg-elevated/50",
                  selectedThread?.id === thread.id ? "bg-bg-elevated" : ""
                )}
              >
                <div className="relative shrink-0">
                  <div className={cn("w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm", thread.color)}>
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
                    <div
                      className={cn(
                        "absolute bottom-0 right-0 w-3 h-3 border-2 border-bg-card rounded-full",
                        presence === 'online' ? 'bg-accent-teal' : 'bg-accent-amber'
                      )}
                    />
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
              })()
            ))}
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
              <div className={cn("relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs", selectedThread?.color || THREAD_COLORS[0])}>
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
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-2.5 h-2.5 border border-bg-card rounded-full",
                      selectedPresence === 'online' ? 'bg-accent-teal' : 'bg-accent-amber'
                    )}
                  />
                )}
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{selectedThread?.name || 'No conversation selected'}</p>
                <p
                  className={cn(
                    "text-[10px] font-medium",
                    selectedThread
                      ? selectedPresence === 'online'
                        ? 'text-accent-teal'
                        : selectedPresence === 'recent'
                          ? 'text-accent-amber'
                          : 'text-text-muted'
                      : 'text-text-muted'
                  )}
                >
                  {selectedThread
                    ? selectedPresence === 'online'
                      ? 'Online'
                      : selectedPresence === 'recent'
                        ? 'Recently Active'
                        : 'Offline'
                    : 'Messages'}
                </p>
              </div>
            </div>
              );
            })()}
            <div className="flex items-center gap-2">
              <HeaderAction
                icon={<MoreVertical className="w-4 h-4" />}
                onClick={() => {
                  if (selectedThread?.id) {
                    navigate(`/profile/${selectedThread.id}`);
                  }
                }}
              />
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            {!selectedThread ? (
              <div className="text-sm text-text-muted">Select a conversation to start chatting.</div>
            ) : loadingConversation ? (
              <div className="text-sm text-text-muted">Loading conversation...</div>
            ) : selectedMessages.length === 0 ? (
              <div className="text-sm text-text-muted">No messages yet. Say hello.</div>
            ) : selectedMessages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3 max-w-[80%]", msg.fromMe ? "ml-auto flex-row-reverse" : "")}>
                {!msg.fromMe && (
                  <div className={cn("w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] shrink-0 mt-auto", selectedThread.color)}>
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
                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                    msg.fromMe 
                      ? "bg-accent-teal/10 border border-accent-teal/20 text-text-primary rounded-br-none" 
                      : "bg-bg-elevated text-text-secondary rounded-bl-none"
                  )}>
                    {msg.text}
                  </div>
                  <p className={cn("text-[9px] font-mono text-text-muted", msg.fromMe ? "text-right" : "")}>{msg.time}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} aria-hidden className="h-px shrink-0" />
          </div>

          {/* Input */}
          <footer className="p-6 bg-bg-card/90 border-t border-white/5">
            {pendingIncomingCollabRequest && (
              <div className="mb-4 rounded-2xl border border-accent-teal/25 bg-accent-teal/10 p-4 shadow-sm">
                <p className="text-sm font-semibold text-text-primary">Collab request</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  This person wants to connect with you. Accept to continue the conversation, or decline politely.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCollabDecision('accept')}
                    disabled={handlingCollabDecision}
                    className="rounded-xl bg-accent-teal px-4 py-2 text-sm font-semibold text-bg-base transition-all hover:bg-[#00f5b4] disabled:opacity-50"
                  >
                    {handlingCollabDecision ? 'Sending...' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCollabDecision('decline')}
                    disabled={handlingCollabDecision}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-text-primary transition-all hover:bg-white/5 disabled:opacity-50"
                  >
                    {handlingCollabDecision ? 'Sending...' : 'Decline'}
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={pendingIncomingCollabRequest ? 'Accept or decline the request first' : 'Type a message...'}
                disabled={!selectedThread || pendingIncomingCollabRequest}
                className="flex-1 bg-bg-elevated border border-white/5 rounded-2xl px-6 py-3 text-sm outline-none focus:border-accent-teal transition-all"
              />
              <button 
                type="submit"
                disabled={!selectedThread || !message.trim() || pendingIncomingCollabRequest}
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

function HeaderAction({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all">
      {icon}
    </button>
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
  // Prefer live presence; fallback to recent message activity.
  if (onlineUserIds.has(thread.id)) {
    return 'online';
  }

  const diffMs = Date.now() - thread.lastTimestamp;
  if (diffMs < 2 * 60 * 1000) {
    return 'recent';
  }
  if (diffMs < 15 * 60 * 1000) {
    return 'recent';
  }
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

