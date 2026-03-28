import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Profile } from '@/src/types';
import { cn, getInitials } from '@/src/lib/utils';
import { Send, Search, MoreVertical, Phone, Video, Info } from 'lucide-react';
import { toast } from 'sonner';

interface MessagesPageProps {
  profile: Profile | null;
}

export default function MessagesPage({ profile }: MessagesPageProps) {
  const [selectedThread, setSelectedThread] = useState(MOCK_THREADS[0]);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedThread]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    // Mock sending message
    toast.success('Message sent!');
    setMessage('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-128px)]">
      <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden grid grid-cols-[320px_1fr] h-full shadow-2xl">
        
        {/* Thread List */}
        <aside className="border-r border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Messages</h2>
              <button className="text-accent-teal hover:bg-accent-teal/10 p-2 rounded-xl transition-all">
                <EditIcon />
              </button>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-teal transition-colors" />
              <input 
                type="text" 
                placeholder="Search messages..."
                className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:border-accent-teal transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {MOCK_THREADS.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={cn(
                  "w-full p-4 flex gap-4 items-center transition-all hover:bg-bg-elevated/50",
                  selectedThread.id === thread.id ? "bg-bg-elevated" : ""
                )}
              >
                <div className="relative shrink-0">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm", thread.color)}>
                    {getInitials(thread.name)}
                  </div>
                  {thread.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent-teal border-2 border-bg-card rounded-full" />
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
            ))}
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex flex-col h-full bg-bg-base/30">
          {/* Header */}
          <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-bg-card/50 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs", selectedThread.color)}>
                {getInitials(selectedThread.name)}
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{selectedThread.name}</p>
                <p className={cn("text-[10px] font-medium", selectedThread.online ? "text-accent-teal" : "text-text-muted")}>
                  {selectedThread.online ? '● Online' : 'Offline'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HeaderAction icon={<Phone className="w-4 h-4" />} />
              <HeaderAction icon={<Video className="w-4 h-4" />} />
              <HeaderAction icon={<Info className="w-4 h-4" />} />
              <HeaderAction icon={<MoreVertical className="w-4 h-4" />} />
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
            {MOCK_MESSAGES.map((msg, i) => (
              <div key={i} className={cn("flex gap-3 max-w-[80%]", msg.fromMe ? "ml-auto flex-row-reverse" : "")}>
                {!msg.fromMe && (
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-auto", selectedThread.color)}>
                    {getInitials(selectedThread.name)}
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
          <footer className="p-6 bg-bg-card/50 backdrop-blur-xl border-t border-white/5">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-bg-elevated border border-white/5 rounded-2xl px-6 py-3 text-sm outline-none focus:border-accent-teal transition-all"
              />
              <button 
                type="submit"
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

function HeaderAction({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all">
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

const MOCK_THREADS = [
  { id: '1', name: 'Dr. Priya Nair', lastMessage: 'Great question about load balancers!', time: '2h', unread: 2, online: true, color: 'bg-[#004D3A] text-accent-teal' },
  { id: '2', name: 'Rajesh Kumar', lastMessage: 'Check out assignment #3 feedback', time: '1d', unread: 0, online: false, color: 'bg-[#2D1B69] text-[#C4B5FD]' },
  { id: '3', name: 'Melvin Jose', lastMessage: 'Congrats on your certificate! 🎉', time: '2d', unread: 0, online: true, color: 'bg-[#0D2757] text-[#93C5FD]' },
];

const MOCK_MESSAGES = [
  { text: "Great question about load balancers! Let me explain the key difference...", time: "10:30 AM", fromMe: false },
  { text: "Thank you! That cleared everything up 🙌", time: "10:35 AM", fromMe: true },
  { text: "Keep it up! Your Module 4 quiz score was excellent 🎉", time: "10:40 AM", fromMe: false },
];
