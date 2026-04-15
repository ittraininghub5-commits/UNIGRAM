import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Profile } from '@/src/types';
import { cn, getInitials } from '@/src/lib/utils';
import { Send, Search, MoreVertical, Phone, Video, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';

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
  'bg-[#004D3A] text-accent-teal',
  'bg-[#2D1B69] text-[#C4B5FD]',
  'bg-[#0D2757] text-[#93C5FD]',
  'bg-[#5A2A00] text-[#FDBA74]',
  'bg-[#3A1A5E] text-[#E9D5FF]',
];

interface MessagesPageProps {
  profile: Profile | null;
}

export default function MessagesPage({ profile }: MessagesPageProps) {
  const location = useLocation();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationByThread, setConversationByThread] = useState<Record<string, UiMessage[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedThreadId, conversationByThread]);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    void loadMessages();

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setOnlineUserIds(new Set());
      return;
    }

    const presenceChannel = supabase.channel('messages-presence', {
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
          await presenceChannel.track({
            userId: profile.id,
            onlineAt: new Date().toISOString(),
          });
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
  }, [profile?.id, selectedThreadId, threads]);

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

  const preferredThreadId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('thread');
  }, [location.search]);

  const ensureThreadExists = async (threadId: string) => {
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
  };

  const loadMessages = async () => {
    if (!profile?.id) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id, from_id, to_id, content, read, created_at')
        .or(`from_id.eq.${profile.id},to_id.eq.${profile.id}`)
        .order('created_at', { ascending: true })
        .limit(300);

      if (error) throw error;

      const allMessages = (data || []) as DbMessage[];
      const participantIds = Array.from(new Set(allMessages
        .map((m) => (m.from_id === profile.id ? m.to_id : m.from_id))
        .filter(Boolean)));

      const profilesMap = new Map<string, Profile>();
      if (participantIds.length > 0) {
        const { data: participantProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', participantIds);

        if (!profilesError) {
          (participantProfiles || []).forEach((p: any) => profilesMap.set(p.id, p as Profile));
        }
      }

      const conversations: Record<string, UiMessage[]> = {};
      const threadsMap = new Map<string, Thread>();

      allMessages.forEach((msg) => {
        const partnerId = msg.from_id === profile.id ? msg.to_id : msg.from_id;
        if (!partnerId) return;

        if (!conversations[partnerId]) {
          conversations[partnerId] = [];
        }

        conversations[partnerId].push({
          id: msg.id,
          text: msg.content || '',
          time: formatMessageTime(msg.created_at),
          fromMe: msg.from_id === profile.id,
        });

        const partner = profilesMap.get(partnerId);
        const existing = threadsMap.get(partnerId);
        const unreadIncrement = msg.to_id === profile.id && !msg.read ? 1 : 0;
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

      const orderedThreads = Array.from(threadsMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);

      setConversationByThread(conversations);
      setThreads(orderedThreads);
      setSelectedThreadId((prev) => preferredThreadId || prev || orderedThreads[0]?.id || null);
    } catch (err) {
      console.error('Error loading messages:', err);
      toast.error('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!preferredThreadId) {
      return;
    }

    void ensureThreadExists(preferredThreadId);
    setSelectedThreadId(preferredThreadId);
  }, [preferredThreadId, threads]);

  const markThreadAsRead = async (threadId: string) => {
    if (!profile?.id) {
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('to_id', profile.id)
        .eq('from_id', threadId)
        .eq('read', false);

      if (error) throw error;
      await loadMessages();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !profile?.id || !selectedThreadId) return;

    const content = message.trim();
    setMessage('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{ from_id: profile.id, to_id: selectedThreadId, content }]);

      if (error) throw error;
      await loadMessages();
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message.');
    }
  };

  return (
        <div className="pt-24 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[calc(100vh-12rem)] shadow-2xl">
        
        {/* Thread List */}
        <aside className="border-r border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Messages</h2>
              <button
                onClick={() => toast.info('Use Search to start a new conversation.')}
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
        <div className="flex flex-col h-full bg-bg-base/30">
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
              <HeaderAction icon={<Phone className="w-4 h-4" />} onClick={() => toast.info('Voice calling is coming soon.')} />
              <HeaderAction icon={<Video className="w-4 h-4" />} onClick={() => toast.info('Video calling is coming soon.')} />
              <HeaderAction icon={<Info className="w-4 h-4" />} onClick={() => toast.info('Thread details panel is coming soon.')} />
              <HeaderAction icon={<MoreVertical className="w-4 h-4" />} onClick={() => toast.info('More actions coming soon.')} />
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
            {!selectedThread ? (
              <div className="text-sm text-text-muted">Select a conversation to start chatting.</div>
            ) : (conversationByThread[selectedThread.id] || []).length === 0 ? (
              <div className="text-sm text-text-muted">No messages yet. Say hello.</div>
            ) : (conversationByThread[selectedThread.id] || []).map((msg, i) => (
              <div key={i} className={cn("flex gap-3 max-w-[80%]", msg.fromMe ? "ml-auto flex-row-reverse" : "")}>
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
                disabled={!selectedThread || !message.trim()}
                className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base p-3 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0"
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
