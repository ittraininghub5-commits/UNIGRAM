import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { Profile, Video, Enrollment, Course } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import {
  getAIInsightForVideo,
  getAIInsightsForVideos,   // ✅ NEW: batch fetch
  generateAIInsight,
  AIInsight as AIInsightType,
  generateCourseMetadataFromTitle,
} from '@/src/services/aiService';
import { cn, getInitials } from '@/src/lib/utils';
import { Heart, MessageCircle, Share2, Play, CheckCircle2, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants (outside component — never recreated) ─────────────────────────
const TABS = ['For You', 'Following', 'Trending', 'My Courses', 'Quiz'] as const;

const CARD_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};
const CARD_VIEWPORT = { once: true };

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeedPageProps {
  profile: Profile | null;
}

// ─── Subcomponents (unchanged) ────────────────────────────────────────────────
const SidebarStat = memo(function SidebarStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-display font-bold">{value}</div>
      <div className="text-[8px] font-mono text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
});

const ProgressCard = memo(function ProgressCard({
  title, mentor, progress,
}: { title: string; mentor: string; progress: number }) {
  return (
    <div className="bg-bg-elevated rounded-2xl p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-bold leading-tight">{title}</p>
        <p className="text-[10px] text-text-secondary">by {mentor}</p>
      </div>
      <div className="space-y-2">
        <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-teal to-accent-purple"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] font-mono text-accent-teal text-right">{progress}%</p>
      </div>
    </div>
  );
});

const SidebarMentorItem = memo(function SidebarMentorItem({
  mentor, isFollowing, onToggleFollow,
}: { mentor: Profile; isFollowing: boolean; onToggleFollow: (mentorId: string) => Promise<void> }) {
  const handleClick = useCallback(() => onToggleFollow(mentor.id), [mentor.id, onToggleFollow]);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs bg-accent-teal/10 text-accent-teal">
          {mentor.avatar_url ? (
            <img src={mentor.avatar_url} alt={mentor.full_name} className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
          ) : null}
          <span style={{ display: mentor.avatar_url ? 'none' : 'flex' }}>{getInitials(mentor.full_name)}</span>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <p className="text-sm font-bold leading-tight">{mentor.full_name}</p>
            {mentor.is_verified && <CheckCircle2 className="w-3 h-3 text-accent-teal" />}
          </div>
          <p className="text-[10px] text-text-secondary truncate max-w-[120px]">{mentor.institution || 'Expert Mentor'}</p>
        </div>
      </div>
      <button onClick={handleClick}
        className="text-[10px] font-bold text-bg-base bg-accent-teal px-3 py-1.5 rounded-lg hover:brightness-110 transition-all">
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
});

const EnrolledCourseCard = memo(function EnrolledCourseCard({ enrollment }: { enrollment: Enrollment }) {
  const course = enrollment.course;
  if (!course) return null;
  return (
    <m.div variants={CARD_VARIANTS} initial="initial" whileInView="animate" viewport={CARD_VIEWPORT}
      className="editorial-card lift-on-hover rounded-3xl overflow-hidden group">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-64 aspect-video md:aspect-auto relative overflow-hidden">
          <img src={course.thumbnail_url || `https://picsum.photos/seed/${course.id}/400/300`} alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent md:hidden" />
          {enrollment.completed && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-accent-teal text-bg-base text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-lg">
              Completed
            </div>
          )}
        </div>
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {course.tags?.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">{tag}</span>
                ))}
              </div>
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
                Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
              </span>
            </div>
            <Link to={`/course/${course.id}`}>
              <h3 className="text-xl font-display font-bold group-hover:text-accent-teal transition-colors">{course.title}</h3>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-[8px] font-bold text-accent-teal">
                {course.mentor?.avatar_url ? (
                  <img src={course.mentor.avatar_url} className="w-full h-full rounded-full object-cover"
                    referrerPolicy="no-referrer" alt={course.mentor?.full_name || 'Mentor'} loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
                ) : null}
                <span style={{ display: course.mentor?.avatar_url ? 'none' : 'flex' }}>
                  {getInitials(course.mentor?.full_name || 'Mentor')}
                </span>
              </div>
              <span className="text-xs text-text-secondary">{course.mentor?.full_name}</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Course Progress</span>
              <span className="text-xs font-bold text-accent-teal">{enrollment.progress_pct}%</span>
            </div>
            <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <m.div initial={{ width: 0 }} animate={{ width: `${enrollment.progress_pct}%` }}
                className="h-full bg-gradient-to-r from-accent-teal to-accent-purple" />
            </div>
            <div className="flex justify-end">
              <Link to={`/course/${course.id}`}
                className="text-xs font-bold text-text-primary hover:text-accent-teal transition-colors flex items-center gap-1">
                {enrollment.progress_pct === 0 ? 'Start Learning' : 'Continue Learning'}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </m.div>
  );
});

// ─── PostCard ─────────────────────────────────────────────────────────────────
// ✅ FIX 1: Accepts `initialInsight` as a prop instead of fetching it itself.
// The parent now batch-fetches all insights in one query and passes them down.
const PostCard = memo(function PostCard({
  video, isFollowingMentor, onToggleFollow, viewerRole, initialInsight,
}: {
  video: Video;
  isFollowingMentor: boolean;
  onToggleFollow: (mentorId: string) => Promise<void>;
  viewerRole?: 'student' | 'mentor';
  initialInsight: AIInsightType | null;   // ← new prop
}) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [insight, setInsight] = useState<AIInsightType | null>(initialInsight);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const studentCardClickable = viewerRole === 'student' && !!video.course_id;

  // ✅ Sync prop → state if parent re-fetches (tab change, etc.)
  useEffect(() => { setInsight(initialInsight); }, [initialInsight]);

  // ✅ REMOVED: the individual getAIInsightForVideo(video.id) useEffect that used
  // to fire for every single card. That N+1 fetch is now done in batch by FeedPage.

  const formattedDuration = useMemo(() => {
    const total = video.duration_sec || 0;
    if (total <= 0) return '--:--';
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [video.duration_sec]);

  const handleCardClick    = useCallback(() => { if (studentCardClickable) navigate(`/course/${video.course_id}`); }, [studentCardClickable, navigate, video.course_id]);
  const handleFollowClick  = useCallback((e: React.MouseEvent) => { e.stopPropagation(); if (video.mentor?.id) void onToggleFollow(video.mentor.id); }, [video.mentor?.id, onToggleFollow]);
  const handleMessageClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); if (video.mentor?.id) navigate(`/messages?thread=${video.mentor.id}`); else toast.error('Mentor ID not available for messaging.'); }, [navigate, video.mentor?.id]);
  const handleLikeClick    = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setLiked((p) => !p); }, []);
  const handleCommentClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); navigate(`/course/${video.course_id}`); }, [navigate, video.course_id]);
  const handleShareClick   = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(`${window.location.origin}/course/${video.course_id}`); toast.success('Course link copied to clipboard.'); }
    catch { toast.error('Unable to copy link.'); }
  }, [video.course_id]);

  const handleGenerateInsight = useCallback(async () => {
    if (!video.id) return;
    setLoadingInsight(true);
    try {
      const newInsight = await generateAIInsight(video.id, video.title, video.description);
      setInsight(newInsight);
      setShowInsight(true);
      toast.success('AI Insight generated!');
    } catch { toast.error('Failed to generate AI insight. Check your API key.'); }
    finally { setLoadingInsight(false); }
  }, [video.id, video.title, video.description]);

  const handleToggleInsight = useCallback(() => setShowInsight((p) => !p), []);

  return (
    <m.div variants={CARD_VARIANTS} initial="initial" whileInView="animate" viewport={CARD_VIEWPORT}
      className={cn('editorial-card lift-on-hover rounded-3xl overflow-hidden group', studentCardClickable && 'cursor-pointer')}
      onClick={handleCardClick}>
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-xs font-bold text-accent-teal">
            {video.mentor?.avatar_url ? (
              <img src={video.mentor.avatar_url} alt={video.mentor.full_name} className="w-full h-full object-cover"
                referrerPolicy="no-referrer" loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
            ) : null}
            <span style={{ display: video.mentor?.avatar_url ? 'none' : 'flex' }}>
              {video.mentor ? getInitials(video.mentor.full_name) : '??'}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold flex items-center gap-1">
              {video.mentor?.full_name}
              {video.mentor?.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" />}
            </p>
            <p className="text-[10px] text-text-secondary">
              {video.mentor?.institution} • {video.mentor?.followers_count} students
            </p>
          </div>
        </div>
        <button onClick={handleFollowClick} disabled={!video.mentor?.id}
          className="text-[10px] font-bold text-accent-teal border border-accent-teal/20 px-4 py-1.5 rounded-xl hover:bg-accent-teal hover:text-bg-base transition-all disabled:opacity-50">
          {isFollowingMentor ? 'Following' : '+ Follow'}
        </button>
        {isFollowingMentor && video.mentor?.id && (
          <button onClick={handleMessageClick}
            className="text-[10px] font-bold text-text-secondary border border-white/10 px-4 py-1.5 rounded-xl hover:bg-white/5 transition-all">
            Message
          </button>
        )}
      </div>

      <div className="aspect-video bg-bg-elevated relative group/video cursor-pointer overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/5 to-accent-purple/5" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/55 border-2 border-white/20 flex items-center justify-center group-hover/video:scale-110 group-hover/video:bg-accent-teal group-hover/video:border-accent-teal transition-all">
            <Play className="w-6 h-6 fill-current text-white ml-1" />
          </div>
        </div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-lg bg-accent-teal/12 border border-accent-teal/20 text-[10px] font-bold text-accent-teal uppercase tracking-widest">
            {video.course?.tags?.[0] || 'Learning'}
          </span>
        </div>
        <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/60 text-[10px] font-mono text-white">
          {formattedDuration}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {video.course_id ? (
          <Link to={`/course/${video.course_id}`} className="block group/title">
            <h3 className="text-xl font-display font-bold leading-tight group-hover/title:text-accent-teal transition-colors">{video.title}</h3>
          </Link>
        ) : (
          <h3 className="text-xl font-display font-bold leading-tight">{video.title}</h3>
        )}
        <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">{video.description}</p>
        <div className="flex flex-wrap gap-2">
          {video.course?.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] text-text-muted">#{tag.replace(/\s/g, '')}</span>
          ))}
        </div>

        <div className="pt-4 border-t border-white/5">
          {!insight ? (
            <button onClick={handleGenerateInsight} disabled={loadingInsight}
              className="flex items-center gap-2 text-[10px] font-bold text-accent-teal hover:text-accent-amber transition-colors disabled:opacity-50">
              {loadingInsight ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {loadingInsight ? 'Generating AI Insights...' : 'Generate AI Insights'}
            </button>
          ) : (
            <div className="space-y-3">
              <button onClick={handleToggleInsight}
                className="flex items-center gap-2 text-[10px] font-bold text-accent-teal hover:text-accent-amber transition-colors">
                <Sparkles className="w-3 h-3" />
                {showInsight ? 'Hide AI Insights' : 'Show AI Insights'}
              </button>
              {showInsight && (
                <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="bg-bg-elevated/50 rounded-2xl p-4 border border-accent-teal/10 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">AI Summary</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{insight.summary}</p>
                  </div>
                  {insight.key_takeaways?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">Key Takeaways</p>
                      <ul className="space-y-1">
                        {insight.key_takeaways.map((t, i) => (
                          <li key={i} className="text-[11px] text-text-secondary flex gap-2">
                            <span className="text-accent-teal">•</span>{t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </m.div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleLikeClick}
            className={cn('flex items-center gap-2 text-xs transition-colors', liked ? 'text-pink-500' : 'text-text-secondary hover:text-text-primary')}>
            <Heart className={cn('w-4 h-4', liked && 'fill-current')} /> {(video.likes_count || 0) + (liked ? 1 : 0)}
          </button>
          <button onClick={handleCommentClick}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <MessageCircle className="w-4 h-4" /> {video.comments_count}
          </button>
          <button onClick={handleShareClick}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        {viewerRole !== 'student' && video.course_id && (
          <Link to={`/course/${video.course_id}`}
            className="bg-accent-teal hover:brightness-110 text-bg-base px-6 py-2 rounded-xl text-xs font-bold font-display transition-all flex items-center gap-1.5">
            View Course <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </m.div>
  );
});

// ─── CourseAnnouncementCard (unchanged except m. prefix) ─────────────────────
const CourseAnnouncementCard = memo(function CourseAnnouncementCard({
  course, isFollowingMentor, onToggleFollow, viewerRole,
}: {
  course: Course;
  isFollowingMentor: boolean;
  onToggleFollow: (mentorId: string) => Promise<void>;
  viewerRole?: 'student' | 'mentor';
}) {
  const navigate = useNavigate();
  const studentCardClickable = viewerRole === 'student';
  const handleCardClick   = useCallback(() => { if (studentCardClickable) navigate(`/course/${course.id}`); }, [studentCardClickable, navigate, course.id]);
  const handleFollowClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); if (course.mentor?.id) void onToggleFollow(course.mentor.id); }, [onToggleFollow, course.mentor]);
  const handleMessageClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); if (course.mentor?.id) navigate(`/messages?thread=${course.mentor.id}`); else toast.error('Mentor ID not available for messaging.'); }, [navigate, course.mentor]);

  return (
    <m.div variants={CARD_VARIANTS} initial="initial" whileInView="animate" viewport={CARD_VIEWPORT}
      className={cn('editorial-card lift-on-hover rounded-3xl overflow-hidden', studentCardClickable && 'cursor-pointer')}
      onClick={handleCardClick}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-xs font-bold text-accent-teal">
              {course.mentor?.avatar_url ? (
                <img src={course.mentor.avatar_url} alt={course.mentor.full_name} className="w-full h-full object-cover"
                  referrerPolicy="no-referrer" loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
              ) : null}
              <span style={{ display: course.mentor?.avatar_url ? 'none' : 'flex' }}>
                {course.mentor ? getInitials(course.mentor.full_name) : '??'}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold">{course.mentor?.full_name || 'Mentor'}</p>
              <p className="text-[10px] text-text-secondary">New course update</p>
            </div>
          </div>
          {course.mentor?.id && (
            <button onClick={handleFollowClick}
              className="text-[10px] font-bold text-accent-teal border border-accent-teal/20 px-4 py-1.5 rounded-xl hover:bg-accent-teal hover:text-bg-base transition-all">
              {isFollowingMentor ? 'Following' : '+ Follow'}
            </button>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-accent-teal uppercase tracking-[0.2em]">Course Spotlight</p>
          <h3 className="text-xl font-display font-bold">{course.title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{course.description || 'Fresh course published. Check the curriculum and start learning.'}</p>
          <div className="flex flex-wrap gap-2">
            {course.tags?.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] text-text-muted">#{tag.replace(/\s/g, '')}</span>
            ))}
          </div>
        </div>
        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
            Posted {new Date(course.created_at).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            {isFollowingMentor && course.mentor?.id && (
              <button onClick={handleMessageClick}
                className="text-[10px] font-bold text-text-secondary border border-white/10 px-4 py-1.5 rounded-xl hover:bg-white/5 transition-all">
                Message
              </button>
            )}
            {viewerRole !== 'student' && (
              <Link to={`/course/${course.id}`}
                className="bg-accent-teal hover:brightness-110 text-bg-base px-4 py-2 rounded-xl text-xs font-bold font-display transition-all flex items-center gap-1.5">
                View Course <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </m.div>
  );
});

// ─── Main FeedPage ────────────────────────────────────────────────────────────
export default function FeedPage({ profile }: FeedPageProps) {
  const navigate = useNavigate();
  const createPostSectionRef = useRef<HTMLDivElement | null>(null);
  const createPostTitleRef   = useRef<HTMLInputElement | null>(null);

  const [activeTab,              setActiveTab]              = useState('For You');
  const [videos,                 setVideos]                 = useState<Video[]>([]);
  const [videoInsights,          setVideoInsights]          = useState<Map<string, AIInsightType>>(new Map()); // ✅ FIX 1
  const [courseFeed,             setCourseFeed]             = useState<Course[]>([]);
  const [mentorOwnedCourses,     setMentorOwnedCourses]     = useState<Course[]>([]);
  const [enrolledCourses,        setEnrolledCourses]        = useState<any[]>([]);
  const [mentors,                setMentors]                = useState<Profile[]>([]);
  const [followedMentorIds,      setFollowedMentorIds]      = useState<Set<string>>(new Set());
  const [loading,                setLoading]                = useState(true);
  const [glimpseTitle,           setGlimpseTitle]           = useState('');
  const [glimpseDescription,     setGlimpseDescription]     = useState('');
  const [glimpseCourseId,        setGlimpseCourseId]        = useState('');
  const [publishingGlimpse,      setPublishingGlimpse]      = useState(false);
  const [generatingGlimpseDraft, setGeneratingGlimpseDraft] = useState(false);
  const [hasAutoDraftedGlimpse,  setHasAutoDraftedGlimpse]  = useState(false);
  const [showCreatePostComposer, setShowCreatePostComposer] = useState(false);

  // ✅ FIX 2: Keep a stable ref to followedMentorIds so follow-toggle doesn't
  // invalidate fetchVideos and re-trigger the main data effect.
  const followedMentorIdsRef = useRef(followedMentorIds);
  useEffect(() => { followedMentorIdsRef.current = followedMentorIds; }, [followedMentorIds]);

  const trendingTopics = useMemo(() => {
    const tagCounts = new Map<string, number>();
    const collectTags = (tags?: string[] | null) =>
      tags?.forEach((t) => { const tag = t.trim(); if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1); });
    videos.forEach((v) => collectTags(v.course?.tags));
    courseFeed.forEach((c) => collectTags(c.tags));
    enrolledCourses.forEach((e) => collectTags(e.course?.tags));
    return [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);
  }, [videos, courseFeed, enrolledCourses]);

  const feedItems = useMemo(() => {
    const videoItems  = videos.map((v) => ({ type: 'video'  as const, id: `video-${v.id}`,   createdAt: v.created_at, video: v }));
    const courseItems = courseFeed.map((c) => ({ type: 'course' as const, id: `course-${c.id}`, createdAt: c.created_at, course: c }));
    return [...videoItems, ...courseItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [videos, courseFeed]);

  const fetchMentors = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, institution, followers_count, is_verified')
      .ilike('role', 'mentor')
      .limit(8);
    if (!error) setMentors((data || []) as Profile[]);
  }, []);

  const fetchFollows = useCallback(async () => {
    if (!profile?.id) { setFollowedMentorIds(new Set()); return; }
    const { data, error } = await supabase
      .from('follows').select('following_id').eq('follower_id', profile.id);
    if (!error) setFollowedMentorIds(new Set((data || []).map((r: any) => r.following_id)));
  }, [profile?.id]);

  const fetchEnrollments = useCallback(async () => {
    if (!profile?.id) { setEnrolledCourses([]); return; }
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, course:courses(id, title, description, tags, thumbnail_url, mentor_id, status, created_at, mentor:profiles(id, full_name, avatar_url))')
      .eq('student_id', profile.id)
      .order('enrolled_at', { ascending: false });
    if (!error) setEnrolledCourses(data || []);
  }, [profile?.id]);

  // ✅ FIX 2: fetchVideos now reads followedMentorIds from a ref, not from state.
  // This means changing followedMentorIds (follow/unfollow) no longer invalidates
  // this function's identity and no longer triggers a full feed refetch.
  const fetchVideos = useCallback(async (tab: string) => {
    const currentFollowedIds = followedMentorIdsRef.current;
    let query = supabase
      .from('videos')
      .select('id, title, description, video_url, thumbnail_url, duration_sec, likes_count, comments_count, created_at, mentor_id, course_id, mentor:profiles(id, full_name, avatar_url, institution, followers_count, is_verified), course:courses(id, title, tags, status, modules_count, videos_count, ai_processed, updated_at)');

    if (tab === 'Following') {
      if (currentFollowedIds.size === 0) { setVideos([]); return; }
      query = query.in('mentor_id', Array.from(currentFollowedIds));
    }
    query = tab === 'Trending'
      ? query.order('likes_count', { ascending: false })
      : query.order('created_at', { ascending: false });

    const { data, error } = await query.limit(10);
    if (!error) {
      const processedVideos = (data || []).map(item => ({
        ...item,
        mentor: Array.isArray(item.mentor) ? item.mentor[0] || null : item.mentor || null,
        course: Array.isArray(item.course) ? item.course[0] || null : item.course || null,
      })) as Video[];

      if (tab === 'For You') {
        const institution = profile?.institution?.trim().toLowerCase() || '';
        processedVideos.sort((a, b) => {
          const score = (video: Video) => {
            let value = new Date(video.created_at).getTime() / 1_000_000_000;
            if (currentFollowedIds.has(video.mentor_id)) value += 100;
            if (institution && video.mentor?.institution?.trim().toLowerCase() === institution) value += 50;
            value += Math.min(video.likes_count || 0, 30) * 0.5;
            return value;
          };
          return score(b) - score(a);
        });
      }

      setVideos(processedVideos);

      // ✅ FIX 1: Batch-fetch all insights in one query after videos load.
      // Previously: each PostCard called getAIInsightForVideo on mount = N round-trips.
      // Now: one query for all video IDs at once.
      if (processedVideos.length > 0) {
        const ids = processedVideos.map((v) => v.id);
        const insightsMap = await getAIInsightsForVideos(ids);
        setVideoInsights(insightsMap);
      }
    }
  }, [profile?.institution]); // ✅ no longer depends on followedMentorIds

  const fetchCourseFeed = useCallback(async (tab: string) => {
    const currentFollowedIds = followedMentorIdsRef.current;
    let query = supabase
      .from('courses')
      .select('id, title, description, tags, thumbnail_url, created_at, mentor_id, status, modules_count, videos_count, ai_processed, updated_at, mentor:profiles(id, full_name, avatar_url, institution)')
      .eq('status', 'live');
    if (tab === 'Following') {
      if (currentFollowedIds.size === 0) { setCourseFeed([]); return; }
      query = query.in('mentor_id', Array.from(currentFollowedIds));
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(10);
    if (!error) {
      const processedCourses = (data || []).map(item => ({
        ...item,
        mentor: Array.isArray(item.mentor) ? item.mentor[0] || null : item.mentor || null,
      })) as Course[];
      setCourseFeed(processedCourses);
    }
  }, []); // ✅ no longer depends on followedMentorIds

  const fetchMentorOwnedCourses = useCallback(async () => {
    if (!profile?.id || profile.role !== 'mentor') { setMentorOwnedCourses([]); return; }
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, tags, thumbnail_url, mentor_id, status, modules_count, videos_count, ai_processed, created_at, updated_at, mentor:profiles(id, full_name, avatar_url, institution)')
      .eq('mentor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) {
      const processedCourses = (data || []).map(item => ({
        ...item,
        mentor: Array.isArray(item.mentor) ? item.mentor[0] || null : item.mentor || null,
      })) as Course[];
      setMentorOwnedCourses(processedCourses);
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => { void fetchMentors(); },            [fetchMentors]);
  useEffect(() => { void fetchMentorOwnedCourses(); }, [fetchMentorOwnedCourses]);
  useEffect(() => { void fetchFollows(); },            [fetchFollows]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await fetchEnrollments();
        if (activeTab === 'My Courses') { setVideos([]); setCourseFeed([]); }
        else { await Promise.all([fetchVideos(activeTab), fetchCourseFeed(activeTab)]); }
      } finally { setLoading(false); }
    };
    void run();
  }, [activeTab, fetchEnrollments, fetchVideos, fetchCourseFeed]);

  // ✅ FIX 3: Narrowed realtime subscriptions.
  // profiles: scoped to followed mentor IDs only (filter applied where Supabase allows).
  // follows: scoped to this user's follower_id row.
  // enrollments: scoped to this user's student_id row.
  // videos/courses: still broad (no good row-level filter for feed relevance),
  //   but now refresh only their own data, not the full page.
  useEffect(() => {
    const uid = profile?.id;
    const channel = supabase
      .channel(`feed-realtime-${uid || 'guest'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
        if (activeTab !== 'My Courses') void fetchVideos(activeTab);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        if (activeTab !== 'My Courses') void Promise.all([fetchVideos(activeTab), fetchCourseFeed(activeTab)]);
        void fetchMentorOwnedCourses();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void fetchMentors();
      })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: uid ? `follower_id=eq.${uid}` : undefined },
        () => {
          // ✅ FIX 2: Only re-fetch the follow list itself, not the full feed.
          // The feed will reflect follows on next tab change or manual refresh.
          void fetchFollows();
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'enrollments', filter: uid ? `student_id=eq.${uid}` : undefined },
        () => { void fetchEnrollments(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab, fetchCourseFeed, fetchEnrollments, fetchFollows, fetchMentorOwnedCourses, fetchMentors, fetchVideos, profile?.id]);

  // ✅ FIX 2: handleToggleFollow updates local state only — does NOT refetch videos.
  const handleToggleFollow = useCallback(async (mentorId: string) => {
    if (!profile?.id) { navigate('/auth'); return; }
    const isFollowing = followedMentorIdsRef.current.has(mentorId);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', profile.id).eq('following_id', mentorId);
        setFollowedMentorIds((prev) => { const next = new Set(prev); next.delete(mentorId); return next; });
      } else {
        await supabase.from('follows').insert({ follower_id: profile.id, following_id: mentorId });
        setFollowedMentorIds((prev) => new Set(prev).add(mentorId));
      }
    } catch (error: any) {
      toast.error(error.message || 'Could not update follow status.');
    }
  }, [profile?.id, navigate]);

  const handleCreateGlimpsePost = useCallback(async () => {
    if (!profile?.id || profile.role !== 'mentor') { toast.error('Only mentors can create feed posts.'); return; }
    const title = glimpseTitle.trim();
    const description = glimpseDescription.trim();
    if (!title || !description) { toast.error('Add both title and post content.'); return; }
    setPublishingGlimpse(true);
    try {
      const { error } = await supabase.from('videos').insert({
        mentor_id: profile.id, course_id: glimpseCourseId || null,
        title, description, video_url: null, thumbnail_url: null,
        duration_sec: null, likes_count: 0, comments_count: 0,
      });
      if (error) throw error;
      setGlimpseTitle(''); setGlimpseDescription(''); setGlimpseCourseId(''); setHasAutoDraftedGlimpse(false);
      toast.success('Feed post published to follower feeds.');
      await Promise.all([fetchVideos(activeTab), fetchCourseFeed(activeTab)]);
    } catch (error: any) {
      toast.error(error.message || 'Unable to publish feed post.');
    } finally { setPublishingGlimpse(false); }
  }, [profile?.id, profile?.role, glimpseTitle, glimpseDescription, glimpseCourseId, fetchVideos, fetchCourseFeed, activeTab]);

  const handleAutoGenerateGlimpseDraft = useCallback(async () => {
    if (generatingGlimpseDraft || hasAutoDraftedGlimpse || glimpseDescription.trim()) return;
    const selectedCourse = mentorOwnedCourses.find((c) => c.id === glimpseCourseId);
    const draftSeed = glimpseTitle.trim() || selectedCourse?.title?.trim() || 'Mentor quick learning update';
    setGeneratingGlimpseDraft(true);
    try {
      const { description } = await generateCourseMetadataFromTitle(draftSeed);
      const clean = description.trim();
      if (clean) { setGlimpseDescription(clean); setHasAutoDraftedGlimpse(true); }
    } catch { /* silent */ } finally { setGeneratingGlimpseDraft(false); }
  }, [generatingGlimpseDraft, hasAutoDraftedGlimpse, glimpseDescription, mentorOwnedCourses, glimpseCourseId, glimpseTitle]);

  const handleOpenCreatePost = useCallback(() => {
    if (profile?.role !== 'mentor') return;
    setShowCreatePostComposer(true);
    window.setTimeout(() => {
      createPostSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      createPostTitleRef.current?.focus();
    }, 250);
  }, [profile?.role]);

  const handleTabClick = useCallback((tab: string) => {
    if (tab === 'Quiz') { navigate('/quiz'); return; }
    setActiveTab(tab);
  }, [navigate]);

  const completedCount   = useMemo(() => enrolledCourses.filter((e) => e.completed).length, [enrolledCourses]);
  const inProgressCourses = useMemo(() => enrolledCourses.filter((e) => !e.completed).slice(0, 3), [enrolledCourses]);

  // ─── Render ───────────────────────────────────────────────────────────────
  // ✅ FIX 4: Wrap everything in <LazyMotion> so only the domAnimation feature
  // bundle is downloaded, not all of framer-motion. Uses `m.*` instead of `motion.*`.
  return (
    <LazyMotion features={domAnimation} strict>
      <div className="pt-24 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 route-transition">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">

          {/* Main Feed */}
          <div className="space-y-8 min-w-0 lg:order-2">
            {profile?.role === 'mentor' && showCreatePostComposer && (
              <div ref={createPostSectionRef} className="editorial-card lift-on-hover rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-display font-bold">Create Feed Post</h3>
                  <button onClick={() => setShowCreatePostComposer(false)}
                    className="text-[10px] font-bold text-text-secondary hover:text-text-primary transition-colors">Hide</button>
                </div>
                <input ref={createPostTitleRef} value={glimpseTitle} onChange={(e) => setGlimpseTitle(e.target.value)}
                  placeholder="Post title"
                  className="w-full bg-bg-base border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal" />
                <textarea value={glimpseDescription} onChange={(e) => setGlimpseDescription(e.target.value)}
                  onFocus={() => void handleAutoGenerateGlimpseDraft()}
                  placeholder="Share a quick update, teaser, or learning post..."
                  className="w-full bg-bg-base border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal min-h-[96px]" />
                {generatingGlimpseDraft && (
                  <p className="text-[11px] text-text-secondary flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI is drafting a quick update...
                  </p>
                )}
                <select value={glimpseCourseId} onChange={(e) => setGlimpseCourseId(e.target.value)}
                  className="w-full bg-bg-base border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal">
                  <option value="">No linked course (general update)</option>
                  {mentorOwnedCourses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
                <div className="flex justify-end">
                  <button onClick={handleCreateGlimpsePost} disabled={publishingGlimpse}
                    className="brand-button px-5 py-2.5 text-sm disabled:opacity-50">
                    {publishingGlimpse ? 'Publishing...' : 'Publish Feed Post'}
                  </button>
                </div>
              </div>
            )}

            {/* Stories */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {mentors.slice(0, 6).map((mentor) => (
                <button key={mentor.id} className="flex-shrink-0 group space-y-2 text-center w-20"
                  onClick={() => navigate(`/profile/${mentor.id}`)}>
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-accent-teal to-accent-purple group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full overflow-hidden bg-bg-card border-2 border-bg-base flex items-center justify-center text-xl font-bold text-accent-teal">
                      {mentor.avatar_url ? (
                        <img src={mentor.avatar_url} alt={mentor.full_name} className="w-full h-full object-cover"
                          referrerPolicy="no-referrer" loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
                      ) : null}
                      <span style={{ display: mentor.avatar_url ? 'none' : 'flex' }}>{getInitials(mentor.full_name)}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-secondary truncate">{mentor.full_name}</p>
                </button>
              ))}
              {mentors.length === 0 && <p className="text-[10px] text-text-muted py-4">No live mentor stories yet.</p>}
            </div>

            {/* Tabs */}
            <div className="panel-pill rounded-full p-1 gap-1 flex">
              {TABS.map((tab) => (
                <button key={tab} onClick={() => handleTabClick(tab)}
                  className={cn('flex-1 py-2 rounded-full text-xs font-semibold transition-all',
                    activeTab === tab ? 'bg-bg-elevated text-accent-teal' : 'text-text-secondary hover:text-text-primary')}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Feed items */}
            <div className="space-y-6">
              {loading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => <div key={i} className="h-[400px] editorial-card rounded-3xl animate-pulse" />)}
                </div>
              ) : activeTab === 'My Courses' ? (
                enrolledCourses.length > 0
                  ? enrolledCourses.map((e) => <EnrolledCourseCard key={e.id} enrollment={e} />)
                  : (
                    <div className="editorial-card rounded-3xl p-20 text-center space-y-4">
                      <div className="w-20 h-20 bg-bg-elevated rounded-full flex items-center justify-center mx-auto text-3xl">📚</div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-display font-bold">No courses yet</h3>
                        <p className="text-text-secondary text-sm">Start your learning journey by enrolling in a course.</p>
                      </div>
                      <button onClick={() => setActiveTab('Trending')} className="brand-button px-6 py-2.5 text-sm font-display">
                        Explore Courses
                      </button>
                    </div>
                  )
              ) : feedItems.length > 0
                ? feedItems.map((item) =>
                    item.type === 'video'
                      ? <PostCard
                          key={item.id}
                          video={item.video}
                          isFollowingMentor={!!item.video.mentor?.id && followedMentorIds.has(item.video.mentor.id)}
                          onToggleFollow={handleToggleFollow}
                          viewerRole={profile?.role}
                          initialInsight={videoInsights.get(item.video.id) ?? null}  // ✅ FIX 1
                        />
                      : <CourseAnnouncementCard
                          key={item.id}
                          course={item.course}
                          isFollowingMentor={!!item.course.mentor?.id && followedMentorIds.has(item.course.mentor.id)}
                          onToggleFollow={handleToggleFollow}
                          viewerRole={profile?.role}
                        />
                  )
                : (
                  <div className="editorial-card rounded-3xl p-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-bg-elevated rounded-full flex items-center justify-center mx-auto text-3xl">🎥</div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-display font-bold">
                        {activeTab === 'Following' ? 'No posts from followed mentors yet' : 'No live posts yet'}
                      </h3>
                      <p className="text-text-secondary text-sm">
                        {activeTab === 'Following'
                          ? 'Follow mentors to get their latest course content here in realtime.'
                          : 'Mentor uploads will appear here automatically.'}
                      </p>
                    </div>
                  </div>
                )
              }
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block sticky top-24 space-y-5 pr-1 lg:order-1">
            <div className="editorial-card lift-on-hover rounded-[30px] p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#43c0ff] to-[#2b7fff] p-[2px] mx-auto shadow-[0_12px_28px_rgba(67,192,255,0.22)]">
                <div className="w-full h-full rounded-full bg-bg-card overflow-hidden flex items-center justify-center text-[2rem] font-bold text-[#43c0ff]">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover"
                      referrerPolicy="no-referrer" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; const f = e.currentTarget.nextElementSibling as HTMLElement | null; if (f) f.style.display = 'flex'; }} />
                  ) : null}
                  <span style={{ display: profile?.avatar_url ? 'none' : 'flex' }}>
                    {profile ? getInitials(profile.full_name) : '??'}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display font-extrabold text-base uppercase">{profile?.full_name}</h3>
                <span className="inline-flex px-3 py-1 rounded-lg bg-accent-teal/20 text-accent-teal text-[10px] font-mono uppercase tracking-[0.28em]">
                  {profile?.role}
                </span>
              </div>
              <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-2">
                <SidebarStat value={enrolledCourses.length.toString()} label="Courses" />
                <SidebarStat value={completedCount.toString()} label="Certs" />
                <SidebarStat value={profile?.following_count?.toString() || '0'} label="Following" />
              </div>
            </div>

            <div className="editorial-card lift-on-hover rounded-3xl p-6 space-y-6">
              <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Suggested Mentors</h3>
              <div className="space-y-4">
                {mentors.length > 0
                  ? mentors.map((m) => <SidebarMentorItem key={m.id} mentor={m} isFollowing={followedMentorIds.has(m.id)} onToggleFollow={handleToggleFollow} />)
                  : <p className="text-[10px] text-text-muted text-center py-4">No mentors found</p>}
              </div>
            </div>

            <div className="editorial-card lift-on-hover rounded-3xl p-6 space-y-6">
              <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">In Progress</h3>
              <div className="space-y-4">
                {inProgressCourses.map((e) => (
                  <ProgressCard key={e.id} title={e.course?.title || 'Course'} mentor={e.course?.mentor?.full_name || 'Mentor'} progress={e.progress_pct} />
                ))}
                {inProgressCourses.length === 0 && <p className="text-[10px] text-text-muted text-center py-4">No courses in progress</p>}
              </div>
            </div>

            <div className="editorial-card lift-on-hover rounded-3xl p-6 space-y-4">
              <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Trending Topics</h3>
              <div className="flex flex-wrap gap-2">
                {trendingTopics.map((topic) => (
                  <span key={topic} className="px-3 py-1 rounded-lg bg-bg-elevated border border-white/5 text-[10px] text-text-secondary hover:text-accent-teal hover:border-accent-teal/30 cursor-pointer transition-all">
                    {topic}
                  </span>
                ))}
                {trendingTopics.length === 0 && <p className="text-[10px] text-text-muted">No trending topics yet.</p>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </LazyMotion>
  );
}