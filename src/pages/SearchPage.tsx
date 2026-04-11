import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Users, BookOpen, Hash, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { cn, getInitials } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { Profile, Course } from '@/src/types';
import { toast } from 'sonner';

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState<{ mentors: Profile[], courses: Course[] }>({ mentors: [], courses: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch();
      } else {
        setResults({ mentors: [], courses: [] });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, filter]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      let mentorsData: Profile[] = [];
      let coursesData: Course[] = [];

      if (filter === 'all' || filter === 'mentors') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'mentor')
          .ilike('full_name', `%${query}%`)
          .limit(5);
        if (error) throw error;
        mentorsData = data as Profile[];
      }

      if (filter === 'all' || filter === 'courses') {
        const { data, error } = await supabase
          .from('courses')
          .select('*, mentor:profiles (*)')
          .ilike('title', `%${query}%`)
          .limit(5);
        if (error) throw error;
        coursesData = data as Course[];
      }

      setResults({ mentors: mentorsData, courses: coursesData });
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to fetch search results');
    } finally {
      setLoading(false);
    }
  };

  return (
        <div className="pt-18 max-w-7xl mx-auto px-4 ...">
      <div className="space-y-6">
        <h1 className="text-3xl font-display font-extrabold tracking-tight">Search Unigram</h1>
        
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-accent-teal transition-colors" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mentors, courses, topics..."
            className="w-full bg-bg-card border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-lg outline-none focus:border-accent-teal transition-all shadow-xl"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-accent-teal animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterChip label="Mentors" active={filter === 'mentors'} onClick={() => setFilter('mentors')} />
          <FilterChip label="Courses" active={filter === 'courses'} onClick={() => setFilter('courses')} />
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">
          {query ? `Results for "${query}"` : 'Popular Mentors & Courses'}
        </h3>

        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {results.mentors.map((mentor) => (
              <SearchResult 
                key={mentor.id}
                type="mentor"
                initials={getInitials(mentor.full_name)}
                title={mentor.full_name}
                subtitle={`Mentor • ${mentor.institution || 'Expert Mentor'}`}
                badge="Mentor"
                color="bg-accent-teal/10 text-accent-teal"
                isVerified={mentor.is_verified}
                onClick={() => navigate(`/profile/${mentor.id}`)}
              />
            ))}
            {results.courses.map((course) => (
              <SearchResult 
                key={course.id}
                type="course"
                icon="📚"
                title={course.title}
                subtitle={`Course • ${course.mentor?.full_name} • ${course.tags?.join(', ')}`}
                badge="Course"
                onClick={() => navigate(`/course/${course.id}`)}
              />
            ))}
            {!loading && query && results.mentors.length === 0 && results.courses.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <div className="text-4xl">🔍</div>
                <p className="text-text-secondary">No results found for "{query}"</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-xl text-xs font-bold font-display transition-all border",
        active 
          ? "bg-accent-teal/10 border-accent-teal text-accent-teal" 
          : "bg-bg-card border-white/5 text-text-secondary hover:border-white/10 hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}

function SearchResult({ type, icon, initials, title, subtitle, badge, color, isVerified, onClick }: any) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-accent-teal/20 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0",
        color || "bg-bg-elevated text-text-secondary"
      )}>
        {initials || icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold truncate group-hover:text-accent-teal transition-colors">{title}</p>
          {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" />}
        </div>
        <p className="text-[11px] text-text-secondary truncate">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className={cn(
          "px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest",
          badge === 'Mentor' ? "bg-accent-teal/10 text-accent-teal" : 
          badge === 'Course' ? "bg-accent-purple/10 text-accent-purple" : "bg-white/5 text-text-muted"
        )}>
          {badge}
        </span>
        <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-teal group-hover:translate-x-1 transition-all" />
      </div>
    </motion.div>
  );
}
