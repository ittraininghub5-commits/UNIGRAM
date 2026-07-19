import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, Loader2, ArrowRight, ArrowLeft, MessageSquare } from 'lucide-react';
import { cn, getInitials } from '@/src/lib/utils';
import { safeNavigateBack } from '@/src/lib/navigation';
import { supabase } from '@/src/lib/supabase';
import { Profile, Course } from '@/src/types';
import { toast } from 'sonner';

// ─── Animation variants (outside component — never recreated) ─────────────────
const RESULT_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};
const RESULT_TRANSITION = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };

// ─── Subcomponent: FilterChip ─────────────────────────────────────────────────
const FilterChip = memo(function FilterChip({
  label, active, onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-5 py-2 rounded-xl text-xs font-bold transition-all border',
        active
          ? 'bg-accent-amber/20 border-accent-amber text-accent-amber'
          : 'bg-bg-elevated/60 border-white/10 text-text-secondary hover:border-white/25 hover:text-text-primary',
      )}
    >
      {label}
    </button>
  );
});

// ─── Subcomponent: SearchResult ───────────────────────────────────────────────
const SearchResult = memo(function SearchResult({
  type, icon, avatarUrl, initials, title, subtitle, badge, color, isVerified, onClick, onMessage,
}: {
  type: string;
  icon?: string;
  avatarUrl?: string;
  initials?: string;
  title: string;
  subtitle: string;
  badge: string;
  color?: string;
  isVerified?: boolean;
  onClick: () => void;
  onMessage?: () => void;
}) {
  return (
    <motion.div
      layout
      variants={RESULT_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={RESULT_TRANSITION}
      className={cn(
        'border rounded-2xl p-4 flex items-center gap-4 transition-all group',
        'bg-bg-card/70 border-white/10 hover:border-accent-amber/60',
      )}
    >
      <button type="button" onClick={onClick} className="flex items-center gap-4 flex-1 min-w-0 text-left cursor-pointer">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden',
          color || 'bg-bg-elevated text-text-secondary',
        )}>
          {(type === 'mentor' || type === 'student') && avatarUrl ? (
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
          <span style={{ display: (type === 'mentor' || type === 'student') && avatarUrl ? 'none' : 'flex' }}>
            {initials || icon}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold truncate transition-colors text-text-primary group-hover:text-accent-amber">
              {title}
            </p>
            {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-accent-amber" />}
          </div>
          <p className="text-[11px] truncate text-text-secondary">{subtitle}</p>
        </div>
      </button>

      <div className="flex items-center gap-3 shrink-0">
        <span className={cn(
          'px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest',
          badge === 'Mentor'
            ? 'bg-accent-amber/15 text-accent-amber'
            : badge === 'Student'
              ? 'bg-accent-teal/15 text-accent-teal'
              : badge === 'Course'
                ? 'bg-accent-purple/15 text-accent-purple'
                : 'bg-white/5 text-text-secondary',
        )}>
          {badge}
        </span>
        {onMessage && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
            className="p-2 rounded-xl border border-white/10 text-text-secondary hover:text-accent-teal hover:border-accent-teal/30 transition-all"
            title="Send message"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={onClick} className="p-1">
          <ArrowRight className="w-4 h-4 transition-all text-text-muted group-hover:text-accent-amber group-hover:translate-x-1" />
        </button>
      </div>
    </motion.div>
  );
});

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const SearchSkeleton = memo(function SearchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-[84px] border rounded-2xl animate-pulse bg-bg-card/70 border-white/10" />
      ))}
    </div>
  );
});

// ─── Main SearchPage ──────────────────────────────────────────────────────────
export default function SearchPage() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [query,          setQuery]          = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter,         setFilter]         = useState('all');
  const [results,        setResults]        = useState<{ mentors: Profile[]; students: Profile[]; courses: Course[] }>({
    mentors: [], students: [], courses: [],
  });
  const [loading,       setLoading]       = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const searchRequestId = useRef(0);

  // Read query param once on mount only
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get('q') || '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce — waits 300 ms after typing stops before fetching
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search whenever debounced query or filter changes
  useEffect(() => {
    void handleSearch(debouncedQuery, filter);
  }, [debouncedQuery, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async (searchQuery: string, searchFilter: string) => {
    const requestId   = ++searchRequestId.current;
    const trimmedQuery = searchQuery.trim();
    setLoading(true);

    try {
      // ✅ FIX: Build all three queries up-front, then fire them in parallel with
      // Promise.all. Previously they ran sequentially (3× round-trip latency).
      // Now all three run at the same time — total wait = slowest single query.

      const mentorsPromise = (searchFilter === 'all' || searchFilter === 'mentors')
        ? (() => {
            let q = supabase
              .from('profiles')
              .select('id, full_name, avatar_url, role, institution, followers_count, is_verified')
              .ilike('role', 'mentor');
            q = trimmedQuery
              ? q.ilike('full_name', `%${trimmedQuery}%`)
              : q.order('followers_count', { ascending: false });
            return q.limit(8);
          })()
        : Promise.resolve({ data: [], error: null });

      const studentsPromise = (searchFilter === 'all' || searchFilter === 'students')
        ? (() => {
            let q = supabase
              .from('profiles')
              .select('id, full_name, avatar_url, role, institution, followers_count, is_verified')
              .ilike('role', 'student');
            q = trimmedQuery
              ? q.or(`full_name.ilike.%${trimmedQuery}%,institution.ilike.%${trimmedQuery}%`)
              : q.order('created_at', { ascending: false });
            return q.limit(8);
          })()
        : Promise.resolve({ data: [], error: null });

      const coursesPromise = (searchFilter === 'all' || searchFilter === 'courses')
        ? (() => {
            let q = supabase
              .from('courses')
              .select('id, title, tags, created_at, mentor:profiles(id, full_name)')
              .eq('status', 'live');
            q = trimmedQuery
              ? q.ilike('title', `%${trimmedQuery}%`)
              : q.order('created_at', { ascending: false });
            return q.limit(8);
          })()
        : Promise.resolve({ data: [], error: null });

      // All three requests are in-flight simultaneously
      const [mentorsResult, studentsResult, coursesResult] = await Promise.all([
        mentorsPromise,
        studentsPromise,
        coursesPromise,
      ]);

      // Stale-request guard — discard if a newer search has started
      if (requestId !== searchRequestId.current) return;

      if (mentorsResult.error) throw mentorsResult.error;
      if (studentsResult.error) throw studentsResult.error;
      if (coursesResult.error) throw coursesResult.error;

      setResults({
        mentors:  (mentorsResult.data  || []) as Profile[],
        students: (studentsResult.data || []) as Profile[],
        courses:  (coursesResult.data  || []) as Course[],
      });
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to fetch search results');
    } finally {
      if (requestId === searchRequestId.current) setLoading(false);
    }
  }, []);

  // Stable filter callbacks
  const handleFilterAll      = useCallback(() => setFilter('all'),      []);
  const handleFilterMentors  = useCallback(() => setFilter('mentors'),  []);
  const handleFilterStudents = useCallback(() => setFilter('students'), []);
  const handleFilterCourses  = useCallback(() => setFilter('courses'),  []);
  const handleBack           = useCallback(() => safeNavigateBack(navigate, '/feed'), [navigate]);
  const handleMessageUser    = useCallback((userId: string) => navigate(`/messages?thread=${userId}`), [navigate]);

  const totalResults = useMemo(
    () => results.mentors.length + results.students.length + results.courses.length,
    [results],
  );

  return (
    <div className="min-h-screen transition-colors duration-300 bg-bg-base">
      <div className="pt-24 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-text-primary relative">
        <div className="pointer-events-none absolute -top-8 right-6 w-56 h-56 rounded-full bg-[radial-gradient(circle,rgba(34,242,239,0.12),transparent_70%)]" />

        {/* Back */}
        <div>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">Search Unigram</h1>

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
            <FilterChip label="All"      active={filter === 'all'}      onClick={handleFilterAll}      />
            <FilterChip label="Mentors"  active={filter === 'mentors'}  onClick={handleFilterMentors}  />
            <FilterChip label="Students" active={filter === 'students'} onClick={handleFilterStudents} />
            <FilterChip label="Courses"  active={filter === 'courses'}  onClick={handleFilterCourses}  />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">
            {query ? `Results for "${query}"` : 'Popular Mentors & Courses'}
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-text-secondary">
            <span className="px-2 py-1 rounded-lg border bg-bg-elevated/70 border-white/10">
              {totalResults} Results
            </span>
            {(filter === 'all' || filter === 'mentors') && (
              <span className="px-2 py-1 rounded-lg border bg-bg-elevated/70 border-white/10">
                {results.mentors.length} Mentors
              </span>
            )}
            {(filter === 'all' || filter === 'students') && (
              <span className="px-2 py-1 rounded-lg border bg-bg-elevated/70 border-white/10">
                {results.students.length} Students
              </span>
            )}
            {(filter === 'all' || filter === 'courses') && (
              <span className="px-2 py-1 rounded-lg border bg-bg-elevated/70 border-white/10">
                {results.courses.length} Courses
              </span>
            )}
          </div>

          <div className="grid gap-4">
            {loading && !hasLoadedOnce && <SearchSkeleton />}

            <AnimatePresence initial={false} mode="sync">
              {!loading && results.mentors.map((mentor) => (
                <SearchResult
                  key={`mentor-${mentor.id}`}
                  type="mentor"
                  avatarUrl={mentor.avatar_url ?? undefined}
                  initials={getInitials(mentor.full_name)}
                  title={mentor.full_name}
                  subtitle={`Mentor • ${mentor.institution || 'Expert Mentor'}`}
                  badge="Mentor"
                  color="bg-accent-amber/15 text-accent-amber"
                  isVerified={mentor.is_verified}
                  onClick={() => navigate(`/profile/${mentor.id}`)}
                  onMessage={() => handleMessageUser(mentor.id)}
                />
              ))}

              {!loading && results.students.map((student) => (
                <SearchResult
                  key={`student-${student.id}`}
                  type="student"
                  avatarUrl={student.avatar_url ?? undefined}
                  initials={getInitials(student.full_name)}
                  title={student.full_name}
                  subtitle={`Student • ${student.institution || 'Unigram learner'}`}
                  badge="Student"
                  color="bg-accent-teal/15 text-accent-teal"
                  onClick={() => navigate(`/profile/${student.id}`)}
                  onMessage={() => handleMessageUser(student.id)}
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
                />
              ))}

              {!loading && query && totalResults === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="text-4xl">🔍</div>
                  <p className="text-text-secondary">No results found for "{query}"</p>
                </div>
              )}

              {!loading && !query && totalResults === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="text-4xl">📚</div>
                  <p className="text-text-secondary">No people or courses available right now.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}