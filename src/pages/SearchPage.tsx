import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn, getInitials } from '@/src/lib/utils';
import { safeNavigateBack } from '@/src/lib/navigation';
import { supabase } from '@/src/lib/supabase';
import { Profile, Course } from '@/src/types';
import { useTheme } from '@/src/context/ThemeContext';
import { toast } from 'sonner';

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState<{ mentors: Profile[], courses: Course[] }>({ mentors: [], courses: [] });
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const searchRequestId = useRef(0);

  const totalResults = useMemo(() => results.mentors.length + results.courses.length, [results]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') || '';
    setQuery(q);
  }, [location.search]);

  useEffect(() => {
    void handleSearch();
  }, [query, filter]);

  const handleSearch = async () => {
    const requestId = ++searchRequestId.current;
    const trimmedQuery = query.trim();
    setLoading(true);
    try {
      let mentorsData: Profile[] = [];
      let coursesData: Course[] = [];

      if (filter === 'all' || filter === 'mentors') {
        let mentorsQuery = supabase
          .from('profiles')
          .select('*')
          .ilike('role', 'mentor');

        if (trimmedQuery) {
          mentorsQuery = mentorsQuery.ilike('full_name', `%${trimmedQuery}%`);
        } else {
          mentorsQuery = mentorsQuery.order('followers_count', { ascending: false });
        }

        const { data, error } = await mentorsQuery.limit(8);
        if (error) throw error;
        mentorsData = data as Profile[];
      }

      if (filter === 'all' || filter === 'courses') {
        let coursesQuery = supabase
          .from('courses')
          .select('*, mentor:profiles (*)')
          .eq('status', 'live');

        if (trimmedQuery) {
          coursesQuery = coursesQuery.ilike('title', `%${trimmedQuery}%`);
        } else {
          coursesQuery = coursesQuery.order('created_at', { ascending: false });
        }

        const { data, error } = await coursesQuery.limit(8);
        if (error) throw error;
        coursesData = data as Course[];
      }

      // Ignore stale responses when a newer request is already in-flight.
      if (requestId !== searchRequestId.current) {
        return;
      }

      setResults({ mentors: mentorsData, courses: coursesData });
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to fetch search results');
    } finally {
      if (requestId === searchRequestId.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-bg-base">
      <div className="pt-24 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-text-primary relative">
        <div className="pointer-events-none absolute -top-8 right-6 w-56 h-56 rounded-full bg-[radial-gradient(circle,rgba(34,242,239,0.12),transparent_70%)]" />
        {/* Back Button */}
        <div>
          <button
            onClick={() => safeNavigateBack(navigate, '/feed')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Header - Centered */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            Search Unigram
          </h1>
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors text-text-muted group-focus-within:text-accent-amber" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mentors, courses, topics..."
              className="w-full rounded-full py-3.5 pl-12 pr-4 text-base outline-none transition-all border bg-bg-card/70 border-white/10 text-text-primary placeholder-text-muted focus:border-accent-amber"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-accent-amber animate-spin" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} theme={theme} />
            <FilterChip label="Mentors" active={filter === 'mentors'} onClick={() => setFilter('mentors')} theme={theme} />
            <FilterChip label="Courses" active={filter === 'courses'} onClick={() => setFilter('courses')} theme={theme} />
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">
            {query ? `Results for "${query}"` : 'Popular Mentors & Courses'}
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-secondary">
            <span className={`px-2 py-1 rounded-lg border ${
              'bg-bg-elevated/70 border-white/10'
            }`}>{totalResults} Results</span>
            {(filter === 'all' || filter === 'mentors') && (
              <span className={`px-2 py-1 rounded-lg border ${
                'bg-bg-elevated/70 border-white/10'
              }`}>{results.mentors.length} Mentors</span>
            )}
            {(filter === 'all' || filter === 'courses') && (
              <span className={`px-2 py-1 rounded-lg border ${
                'bg-bg-elevated/70 border-white/10'
              }`}>{results.courses.length} Courses</span>
            )}
          </div>

          <div className="grid gap-4">
            {loading && !hasLoadedOnce && (
              <div className="space-y-3">
                {[1, 2, 3].map((skeleton) => (
                  <div key={skeleton} className="h-[84px] border rounded-2xl animate-pulse bg-bg-card/70 border-white/10" />
                ))}
              </div>
            )}

            <AnimatePresence initial={false} mode="sync">
              {!loading && results.mentors.map((mentor) => (
                <SearchResult 
                  key={`mentor-${mentor.id}`}
                  type="mentor"
                  avatarUrl={mentor.avatar_url}
                  initials={getInitials(mentor.full_name)}
                  title={mentor.full_name}
                  subtitle={`Mentor • ${mentor.institution || 'Expert Mentor'}`}
                  badge="Mentor"
                  color="bg-accent-amber/15 text-accent-amber"
                  isVerified={mentor.is_verified}
                  onClick={() => navigate(`/profile/${mentor.id}`)}
                  theme={theme}
                />
              ))}
              {!loading && results.courses.map((course) => (
                <SearchResult 
                  key={`course-${course.id}`}
                  type="course"
                  icon="📚"
                  title={course.title}
                  subtitle={`Course • ${course.mentor?.full_name} • ${course.tags?.join(', ')}`}
                  badge="Course"
                  onClick={() => navigate(`/course/${course.id}`)}
                  theme={theme}
                />
              ))}
              {!loading && query && results.mentors.length === 0 && results.courses.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="text-4xl">🔍</div>
                  <p className="text-text-secondary">No results found for "{query}"</p>
                </div>
              )}
              {!loading && !query && results.mentors.length === 0 && results.courses.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="text-4xl">📚</div>
                  <p className="text-text-secondary">No mentors or live courses available right now.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, theme }: { label: string; active: boolean; onClick: () => void; theme: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-xl text-xs font-bold transition-all border",
        active 
          ? "bg-accent-amber/20 border-accent-amber text-accent-amber" 
          : "bg-bg-elevated/60 border-white/10 text-text-secondary hover:border-white/25 hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}

function SearchResult({ type, icon, avatarUrl, initials, title, subtitle, badge, color, isVerified, onClick, theme }: any) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className={`border rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer group ${
        'bg-bg-card/70 border-white/10 hover:border-accent-amber/60'
      }`}
      onClick={onClick}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0",
        color || "bg-bg-elevated text-text-secondary"
      )}>
        {type === 'mentor' && avatarUrl ? (
          <img
            src={avatarUrl}
            alt={title}
            className="w-full h-full rounded-xl object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <span style={{ display: type === 'mentor' && avatarUrl ? 'none' : 'flex' }}>
          {initials || icon}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold truncate transition-colors text-text-primary group-hover:text-accent-amber">{title}</p>
          {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-accent-amber" />}
        </div>
        <p className="text-[11px] truncate text-text-secondary">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className={cn(
          "px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest",
          badge === 'Mentor' 
            ? "bg-accent-amber/15 text-accent-amber"
            : badge === 'Course' 
              ? "bg-accent-purple/15 text-accent-purple"
              : "bg-white/5 text-text-secondary"
        )}>
          {badge}
        </span>
        <ArrowRight className="w-4 h-4 transition-all text-text-muted group-hover:text-accent-amber group-hover:translate-x-1" />
      </div>
    </motion.div>
  );
}