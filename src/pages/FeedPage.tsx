import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Profile, Video, Enrollment, Course } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { getAIInsightForVideo, generateAIInsight, AIInsight as AIInsightType, generateCourseMetadataFromTitle } from '@/src/services/aiService';
import { cn, getInitials } from '@/src/lib/utils';
import { Heart, MessageCircle, Share2, Play, Plus, CheckCircle2, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FeedPageProps {
  profile: Profile | null;
}

export default function FeedPage({ profile }: FeedPageProps) {
  const navigate = useNavigate();
  const createPostSectionRef = useRef<HTMLDivElement | null>(null);
  const createPostTitleRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState('For You');
  const [videos, setVideos] = useState<Video[]>([]);
  const [courseFeed, setCourseFeed] = useState<Course[]>([]);
  const [mentorOwnedCourses, setMentorOwnedCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [followedMentorIds, setFollowedMentorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [glimpseTitle, setGlimpseTitle] = useState('');
  const [glimpseDescription, setGlimpseDescription] = useState('');
  const [glimpseCourseId, setGlimpseCourseId] = useState('');
  const [publishingGlimpse, setPublishingGlimpse] = useState(false);
  const [generatingGlimpseDraft, setGeneratingGlimpseDraft] = useState(false);
  const [hasAutoDraftedGlimpse, setHasAutoDraftedGlimpse] = useState(false);
  const [showCreatePostComposer, setShowCreatePostComposer] = useState(false);

  const trendingTopics = useMemo(() => {
    const tagCounts = new Map<string, number>();

    const collectTags = (tags?: string[] | null) => {
      tags?.forEach((rawTag) => {
        const tag = rawTag.trim();
        if (!tag) return;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    };

    videos.forEach((video) => collectTags(video.course?.tags));
    courseFeed.forEach((course) => collectTags(course.tags));
    enrolledCourses.forEach((enrollment) => collectTags(enrollment.course?.tags));

    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [videos, courseFeed, enrolledCourses]);

  const feedItems = useMemo(() => {
    const videoItems = videos.map((video) => ({
      type: 'video' as const,
      id: `video-${video.id}`,
      createdAt: video.created_at,
      video,
    }));

    const courseItems = courseFeed.map((course) => ({
      type: 'course' as const,
      id: `course-${course.id}`,
      createdAt: course.created_at,
      course,
    }));

    return [...videoItems, ...courseItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [videos, courseFeed]);

  const fetchMentors = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('role', 'mentor')
      .limit(8);

    if (error) {
      console.error('Error fetching mentors:', error);
      return;
    }

    setMentors((data || []) as Profile[]);
  }, []);

  const fetchFollows = useCallback(async () => {
    if (!profile?.id) {
      setFollowedMentorIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profile.id);

    if (error) {
      console.error('Error fetching follow state:', error);
      return;
    }

    setFollowedMentorIds(new Set((data || []).map((row: any) => row.following_id)));
  }, [profile?.id]);

  const fetchEnrollments = useCallback(async () => {
    if (!profile?.id) {
      setEnrolledCourses([]);
      return;
    }

    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        course:courses (
          *,
          mentor:profiles (*)
        )
      `)
      .eq('student_id', profile.id)
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      return;
    }

    setEnrolledCourses(data || []);
  }, [profile?.id]);

  const fetchVideos = useCallback(async () => {
    let query = supabase
      .from('videos')
      .select(`
        *,
        mentor:profiles (*),
        course:courses (*)
      `)
      .eq('course.status', 'live');

    if (activeTab === 'Following') {
      const followedIds = [...followedMentorIds];
      if (followedIds.length === 0) {
        setVideos([]);
        return;
      }
      query = query.in('mentor_id', followedIds);
    }

    if (activeTab === 'Trending') {
      query = query.order('likes_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(10);

    if (error) {
      console.error('Error fetching videos:', error);
      return;
    }

    setVideos((data || []) as Video[]);
  }, [activeTab, followedMentorIds]);

  const fetchCourseFeed = useCallback(async () => {
    let query = supabase
      .from('courses')
      .select(`
        *,
        mentor:profiles (*)
      `)
      .eq('status', 'live');

    if (activeTab === 'Following') {
      const followedIds = [...followedMentorIds];
      if (followedIds.length === 0) {
        setCourseFeed([]);
        return;
      }
      query = query.in('mentor_id', followedIds);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query.limit(10);

    if (error) {
      console.error('Error fetching course feed:', error);
      return;
    }

    setCourseFeed((data || []) as Course[]);
  }, [activeTab, followedMentorIds]);

  const fetchMentorOwnedCourses = useCallback(async () => {
    if (!profile?.id || profile.role !== 'mentor') {
      setMentorOwnedCourses([]);
      return;
    }

    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, tags, thumbnail_url, mentor_id, status, modules_count, videos_count, ai_processed, created_at, updated_at')
      .eq('mentor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching mentor courses:', error);
      return;
    }

    setMentorOwnedCourses((data || []) as Course[]);
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    void fetchMentors();
  }, [fetchMentors]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchEnrollments();

        if (activeTab === 'My Courses') {
          setVideos([]);
          setCourseFeed([]);
        } else {
          await Promise.all([fetchVideos(), fetchCourseFeed()]);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [activeTab, fetchCourseFeed, fetchEnrollments, fetchVideos]);

  useEffect(() => {
    void fetchMentorOwnedCourses();
  }, [fetchMentorOwnedCourses]);

  useEffect(() => {
    void fetchFollows();
  }, [fetchFollows]);

  useEffect(() => {
    const channel = supabase
      .channel(`feed-realtime-${profile?.id || 'guest'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
        if (activeTab !== 'My Courses') {
          void fetchVideos();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        if (activeTab !== 'My Courses') {
          void Promise.all([fetchVideos(), fetchCourseFeed()]);
        }
        void fetchMentorOwnedCourses();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void fetchMentors();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        void fetchFollows();
        if (activeTab === 'Following') {
          void Promise.all([fetchVideos(), fetchCourseFeed()]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        void fetchEnrollments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, fetchCourseFeed, fetchEnrollments, fetchFollows, fetchMentorOwnedCourses, fetchMentors, fetchVideos, profile?.id]);

  const handleCreateGlimpsePost = async () => {
    if (!profile?.id || profile.role !== 'mentor') {
      toast.error('Only mentors can create feed posts.');
      return;
    }

    const title = glimpseTitle.trim();
    const description = glimpseDescription.trim();
    if (!title || !description) {
      toast.error('Add both title and post content.');
      return;
    }

    setPublishingGlimpse(true);
    try {
      const { error } = await supabase
        .from('videos')
        .insert({
          mentor_id: profile.id,
          course_id: glimpseCourseId || null,
          title,
          description,
          video_url: null,
          thumbnail_url: null,
          duration_sec: null,
          likes_count: 0,
          comments_count: 0,
        });

      if (error) throw error;

      setGlimpseTitle('');
      setGlimpseDescription('');
      setGlimpseCourseId('');
      setHasAutoDraftedGlimpse(false);
      toast.success('Feed post published to follower feeds.');
      await Promise.all([fetchVideos(), fetchCourseFeed()]);
    } catch (error: any) {
      console.error('Error publishing glimpse:', error);
      toast.error(error.message || 'Unable to publish feed post.');
    } finally {
      setPublishingGlimpse(false);
    }
  };

  const handleAutoGenerateGlimpseDraft = async () => {
    if (generatingGlimpseDraft || hasAutoDraftedGlimpse || glimpseDescription.trim()) {
      return;
    }

    const selectedCourse = mentorOwnedCourses.find((course) => course.id === glimpseCourseId);
    const draftSeed = glimpseTitle.trim() || selectedCourse?.title?.trim() || 'Mentor quick learning update';

    setGeneratingGlimpseDraft(true);
    try {
      const { description } = await generateCourseMetadataFromTitle(draftSeed);
      const cleanDescription = description.trim();
      if (cleanDescription) {
        setGlimpseDescription(cleanDescription);
        setHasAutoDraftedGlimpse(true);
      }
    } catch (error) {
      console.error('Error generating quick update draft:', error);
    } finally {
      setGeneratingGlimpseDraft(false);
    }
  };

  const handleToggleFollow = async (mentorId: string) => {
    if (!profile?.id) {
      navigate('/auth');
      return;
    }

    const isFollowing = followedMentorIds.has(mentorId);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', profile.id)
          .eq('following_id', mentorId);

        if (error) throw error;
        setFollowedMentorIds((prev) => {
          const next = new Set(prev);
          next.delete(mentorId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: profile.id, following_id: mentorId });

        if (error) throw error;
        setFollowedMentorIds((prev) => new Set(prev).add(mentorId));
      }
    } catch (error: any) {
      console.error('Follow toggle error:', error);
      toast.error(error.message || 'Could not update follow status.');
    }
  };

  const handleOpenCreatePost = () => {
    if (profile?.role !== 'mentor') {
      return;
    }

    setShowCreatePostComposer(true);
    window.setTimeout(() => {
      createPostSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      createPostTitleRef.current?.focus();
    }, 250);
  };

  return (
    <div className="pt-24 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 route-transition">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">

        {/* Main Feed */}
        <div className="space-y-8 min-w-0">
          {profile?.role === 'mentor' && showCreatePostComposer && (
            <div ref={createPostSectionRef} className="editorial-card lift-on-hover rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-display font-bold">Create Feed Post</h3>
                <button
                  onClick={() => setShowCreatePostComposer(false)}
                  className="text-[10px] font-bold text-text-secondary hover:text-text-primary transition-colors"
                >
                  Hide
                </button>
              </div>
              <input
                ref={createPostTitleRef}
                value={glimpseTitle}
                onChange={(e) => setGlimpseTitle(e.target.value)}
                placeholder="Post title"
                className="w-full bg-bg-base border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
              />
              <textarea
                value={glimpseDescription}
                onChange={(e) => setGlimpseDescription(e.target.value)}
                onFocus={() => {
                  void handleAutoGenerateGlimpseDraft();
                }}
                placeholder="Share a quick update, teaser, or learning post..."
                className="w-full bg-bg-base border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal min-h-[96px]"
              />
              {generatingGlimpseDraft && (
                <p className="text-[11px] text-text-secondary flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI is drafting a quick update...
                </p>
              )}
              <select
                value={glimpseCourseId}
                onChange={(e) => setGlimpseCourseId(e.target.value)}
                className="w-full bg-bg-base border border-white/10 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
              >
                <option value="">No linked course (general update)</option>
                {mentorOwnedCourses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <div className="flex justify-end">
                <button
                  onClick={handleCreateGlimpsePost}
                  disabled={publishingGlimpse}
                  className="brand-button px-5 py-2.5 text-sm disabled:opacity-50"
                >
                  {publishingGlimpse ? 'Publishing...' : 'Publish Feed Post'}
                </button>
              </div>
            </div>
          )}

          {/* Stories */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {(mentors.length > 0 ? mentors.slice(0, 6) : []).map((mentor) => (
              <button
                key={mentor.id}
                className="flex-shrink-0 group space-y-2 text-center w-20"
                onClick={() => navigate(`/profile/${mentor.id}`)}
              >
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-accent-teal to-accent-purple group-hover:scale-105 transition-transform">
                  <div className="w-full h-full rounded-full overflow-hidden bg-bg-card border-2 border-bg-base flex items-center justify-center text-xl font-bold text-accent-teal">
                    {mentor.avatar_url ? (
                      <img
                        src={mentor.avatar_url}
                        alt={mentor.full_name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span style={{ display: mentor.avatar_url ? 'none' : 'flex' }}>
                      {getInitials(mentor.full_name)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary truncate">{mentor.full_name}</p>
              </button>
            ))}
            {mentors.length === 0 && (
              <p className="text-[10px] text-text-muted py-4">No live mentor stories yet.</p>
            )}
          </div>

          {/* Tabs */}
          <div className="panel-pill rounded-full p-1 gap-1 flex">
            {['For You', 'Following', 'Trending', 'My Courses', 'Quiz'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'Quiz') {
                    navigate('/quiz');
                    return;
                  }
                  setActiveTab(tab);
                }}
                className={cn(
                  "flex-1 py-2 rounded-full text-xs font-semibold transition-all",
                  activeTab === tab ? "bg-bg-elevated text-accent-teal" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Posts / Courses */}
          <div className="space-y-6">
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => <div key={i} className="h-[400px] editorial-card rounded-3xl animate-pulse" />)}
              </div>
            ) : activeTab === 'My Courses' ? (
              enrolledCourses.length > 0 ? (
                enrolledCourses.map((enrollment) => (
                  <EnrolledCourseCard key={enrollment.id} enrollment={enrollment} />
                ))
              ) : (
                <div className="editorial-card rounded-3xl p-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-bg-elevated rounded-full flex items-center justify-center mx-auto text-3xl">📚</div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-bold">No courses yet</h3>
                    <p className="text-text-secondary text-sm">Start your learning journey by enrolling in a course.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('Trending')}
                    className="brand-button px-6 py-2.5 text-sm font-display"
                  >
                    Explore Courses
                  </button>
                </div>
              )
            ) : feedItems.length > 0 ? (
              feedItems.map((item) => (
                item.type === 'video' ? (
                  <PostCard
                    key={item.id}
                    video={item.video}
                    isFollowingMentor={!!item.video.mentor?.id && followedMentorIds.has(item.video.mentor.id)}
                    onToggleFollow={handleToggleFollow}
                    viewerRole={profile?.role}
                  />
                ) : (
                  <CourseAnnouncementCard
                    key={item.id}
                    course={item.course}
                    isFollowingMentor={!!item.course.mentor?.id && followedMentorIds.has(item.course.mentor.id)}
                    onToggleFollow={handleToggleFollow}
                    viewerRole={profile?.role}
                  />
                )
              ))
            ) : (
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
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="hidden lg:block sticky top-24 space-y-5 pr-1">
          <div className="editorial-card lift-on-hover rounded-[30px] p-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#43c0ff] to-[#2b7fff] p-[2px] mx-auto shadow-[0_12px_28px_rgba(67,192,255,0.22)]">
              <div className="w-full h-full rounded-full bg-bg-card overflow-hidden flex items-center justify-center text-[2rem] font-bold text-[#43c0ff]">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
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
              <SidebarStat value={enrolledCourses.filter((e) => e.completed).length.toString()} label="Certs" />
              <SidebarStat value={profile?.following_count?.toString() || '0'} label="Following" />
            </div>
          </div>

          <div className="editorial-card lift-on-hover rounded-3xl p-6 space-y-6">
            <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Suggested Mentors</h3>
            <div className="space-y-4">
              {mentors.length > 0 ? mentors.map((mentor) => (
                <div key={mentor.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs bg-accent-teal/10 text-accent-teal")}>
                      {mentor.avatar_url ? (
                        <img
                          src={mentor.avatar_url}
                          alt={mentor.full_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span style={{ display: mentor.avatar_url ? 'none' : 'flex' }}>
                        {getInitials(mentor.full_name)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold leading-tight">{mentor.full_name}</p>
                        {mentor.is_verified && (
                          <CheckCircle2 className="w-3 h-3 text-accent-teal" />
                        )}
                      </div>
                      <p className="text-[10px] text-text-secondary truncate max-w-[120px]">{mentor.institution || 'Expert Mentor'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleFollow(mentor.id)}
                    className="text-[10px] font-bold text-bg-base bg-accent-teal px-3 py-1.5 rounded-lg hover:brightness-110 transition-all"
                  >
                    {followedMentorIds.has(mentor.id) ? 'Following' : 'Follow'}
                  </button>
                </div>
              )) : (
                <p className="text-[10px] text-text-muted text-center py-4">No mentors found</p>
              )}
            </div>
          </div>

          <div className="editorial-card lift-on-hover rounded-3xl p-6 space-y-6">
            <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">In Progress</h3>
            <div className="space-y-4">
              {enrolledCourses.filter(e => !e.completed).slice(0, 3).map((enrollment) => (
                <ProgressCard 
                  key={enrollment.id}
                  title={enrollment.course?.title || 'Course'} 
                  mentor={enrollment.course?.mentor?.full_name || 'Mentor'} 
                  progress={enrollment.progress_pct} 
                />
              ))}
              {enrolledCourses.filter(e => !e.completed).length === 0 && (
                <p className="text-[10px] text-text-muted text-center py-4">No courses in progress</p>
              )}
            </div>
          </div>

          <div className="editorial-card lift-on-hover rounded-3xl p-6 space-y-4">
            <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Trending Topics</h3>
            <div className="flex flex-wrap gap-2">
              {trendingTopics.map(topic => (
                <span key={topic} className="px-3 py-1 rounded-lg bg-bg-elevated border border-white/5 text-[10px] text-text-secondary hover:text-accent-teal hover:border-accent-teal/30 cursor-pointer transition-all">
                  {topic}
                </span>
              ))}
              {trendingTopics.length === 0 && (
                <p className="text-[10px] text-text-muted">No trending topics yet.</p>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}

function EnrolledCourseCard({ enrollment }: { enrollment: Enrollment }) {
  const course = enrollment.course;
  if (!course) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="editorial-card lift-on-hover rounded-3xl overflow-hidden group"
    >
      <div className="flex flex-col md:flex-row">
        <div className="md:w-64 aspect-video md:aspect-auto relative overflow-hidden">
          <img 
            src={course.thumbnail_url || `https://picsum.photos/seed/${course.id}/400/300`} 
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
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
                {course.tags?.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
                Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
              </span>
            </div>

            <Link to={`/course/${course.id}`}>
              <h3 className="text-xl font-display font-bold group-hover:text-accent-teal transition-colors">
                {course.title}
              </h3>
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-[8px] font-bold text-accent-teal">
                {course.mentor?.avatar_url ? (
                  <img
                    src={course.mentor.avatar_url}
                    className="w-full h-full rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    alt={course.mentor?.full_name || 'Mentor'}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
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
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${enrollment.progress_pct}%` }}
                className="h-full bg-gradient-to-r from-accent-teal to-accent-purple"
              />
            </div>
            <div className="flex justify-end">
              <Link 
                to={`/course/${course.id}`}
                className="text-xs font-bold text-text-primary hover:text-accent-teal transition-colors flex items-center gap-1"
              >
                {enrollment.progress_pct === 0 ? 'Start Learning' : 'Continue Learning'}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SidebarStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-display font-bold">{value}</div>
      <div className="text-[8px] font-mono text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}

function PostCard({
  video,
  isFollowingMentor,
  onToggleFollow,
  viewerRole,
}: {
  video: Video;
  isFollowingMentor: boolean;
  onToggleFollow: (mentorId: string) => Promise<void>;
  viewerRole?: 'student' | 'mentor';
}) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [insight, setInsight] = useState<AIInsightType | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const studentCardClickable = viewerRole === 'student' && !!video.course_id;

  const formattedDuration = useMemo(() => {
    const total = video.duration_sec || 0;
    if (total <= 0) return '--:--';
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [video.duration_sec]);

  useEffect(() => {
    if (video.id) {
      getAIInsightForVideo(video.id).then(setInsight);
    }
  }, [video.id]);

  const handleGenerateInsight = async () => {
    if (!video.id) return;
    setLoadingInsight(true);
    try {
      const newInsight = await generateAIInsight(video.id, video.title, video.description);
      setInsight(newInsight);
      setShowInsight(true);
      toast.success('AI Insight generated!');
    } catch (error) {
      console.error('Error generating insight:', error);
      toast.error('Failed to generate AI insight. Check your API key.');
    } finally {
      setLoadingInsight(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "editorial-card lift-on-hover rounded-3xl overflow-hidden group",
        studentCardClickable && "cursor-pointer"
      )}
      onClick={() => {
        if (studentCardClickable) {
          navigate(`/course/${video.course_id}`);
        }
      }}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-xs font-bold text-accent-teal">
            {video.mentor?.avatar_url ? (
              <img
                src={video.mentor.avatar_url}
                alt={video.mentor.full_name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <span style={{ display: video.mentor?.avatar_url ? 'none' : 'flex' }}>
              {video.mentor ? getInitials(video.mentor.full_name) : '??'}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold flex items-center gap-1">
              {video.mentor?.full_name} 
              {video.mentor?.is_verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-teal" />
              )}
            </p>
            <p className="text-[10px] text-text-secondary">
              {video.mentor?.institution} • {video.mentor?.followers_count} students
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (video.mentor?.id) {
              void onToggleFollow(video.mentor.id);
            }
          }}
          disabled={!video.mentor?.id}
          className="text-[10px] font-bold text-accent-teal border border-accent-teal/20 px-4 py-1.5 rounded-xl hover:bg-accent-teal hover:text-bg-base transition-all disabled:opacity-50"
        >
          {isFollowingMentor ? 'Following' : '+ Follow'}
        </button>
        {isFollowingMentor && video.mentor?.id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/messages?thread=${video.mentor?.id}`);
            }}
            className="text-[10px] font-bold text-text-secondary border border-white/10 px-4 py-1.5 rounded-xl hover:bg-white/5 transition-all"
          >
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
            <h3 className="text-xl font-display font-bold leading-tight group-hover/title:text-accent-teal transition-colors">
              {video.title}
            </h3>
          </Link>
        ) : (
          <h3 className="text-xl font-display font-bold leading-tight">
            {video.title}
          </h3>
        )}
        <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
          {video.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {video.course?.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] text-text-muted">#{tag.replace(/\s/g, '')}</span>
          ))}
        </div>

        {/* AI Insight Section */}
        <div className="pt-4 border-t border-white/5">
          {!insight ? (
            <button 
              onClick={handleGenerateInsight}
              disabled={loadingInsight}
              className="flex items-center gap-2 text-[10px] font-bold text-accent-teal hover:text-accent-amber transition-colors disabled:opacity-50"
            >
              {loadingInsight ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {loadingInsight ? 'Generating AI Insights...' : 'Generate AI Insights'}
            </button>
          ) : (
            <div className="space-y-3">
              <button 
                onClick={() => setShowInsight(!showInsight)}
                className="flex items-center gap-2 text-[10px] font-bold text-accent-teal hover:text-accent-amber transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {showInsight ? 'Hide AI Insights' : 'Show AI Insights'}
              </button>
              
              {showInsight && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-bg-elevated/50 rounded-2xl p-4 border border-accent-teal/10 space-y-3"
                >
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">AI Summary</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{insight.summary}</p>
                  </div>
                  {insight.key_takeaways && insight.key_takeaways.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">Key Takeaways</p>
                      <ul className="space-y-1">
                        {insight.key_takeaways.map((takeaway, i) => (
                          <li key={i} className="text-[11px] text-text-secondary flex gap-2">
                            <span className="text-accent-teal">•</span>
                            {takeaway}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setLiked(!liked);
            }}
            className={cn("flex items-center gap-2 text-xs transition-colors", liked ? "text-pink-500" : "text-text-secondary hover:text-text-primary")}
          >
            <Heart className={cn("w-4 h-4", liked && "fill-current")} /> {video.likes_count + (liked ? 1 : 0)}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/course/${video.course_id}`);
            }}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> {video.comments_count}
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const shareUrl = `${window.location.origin}/course/${video.course_id}`;
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Course link copied to clipboard.');
              } catch {
                toast.error('Unable to copy link.');
              }
            }}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        {viewerRole !== 'student' && video.course_id && (
          <Link 
            to={`/course/${video.course_id}`}
            className="bg-accent-teal hover:brightness-110 text-bg-base px-6 py-2 rounded-xl text-xs font-bold font-display transition-all flex items-center gap-1.5"
          >
            View Course <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

function CourseAnnouncementCard({
  course,
  isFollowingMentor,
  onToggleFollow,
  viewerRole,
}: {
  course: Course;
  isFollowingMentor: boolean;
  onToggleFollow: (mentorId: string) => Promise<void>;
  viewerRole?: 'student' | 'mentor';
}) {
  const navigate = useNavigate();
  const studentCardClickable = viewerRole === 'student';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "editorial-card lift-on-hover rounded-3xl overflow-hidden",
        studentCardClickable && "cursor-pointer"
      )}
      onClick={() => {
        if (studentCardClickable) {
          navigate(`/course/${course.id}`);
        }
      }}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-xs font-bold text-accent-teal">
              {course.mentor?.avatar_url ? (
                <img
                  src={course.mentor.avatar_url}
                  alt={course.mentor.full_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                void onToggleFollow(course.mentor!.id);
              }}
              className="text-[10px] font-bold text-accent-teal border border-accent-teal/20 px-4 py-1.5 rounded-xl hover:bg-accent-teal hover:text-bg-base transition-all"
            >
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/messages?thread=${course.mentor!.id}`);
                }}
                className="text-[10px] font-bold text-text-secondary border border-white/10 px-4 py-1.5 rounded-xl hover:bg-white/5 transition-all"
              >
                Message
              </button>
            )}
            {viewerRole !== 'student' && (
              <Link
                to={`/course/${course.id}`}
                className="bg-accent-teal hover:brightness-110 text-bg-base px-4 py-2 rounded-xl text-xs font-bold font-display transition-all flex items-center gap-1.5"
              >
                View Course <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProgressCard({ title, mentor, progress }: { title: string; mentor: string; progress: number }) {
  return (
    <div className="bg-bg-elevated rounded-2xl p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-bold leading-tight">{title}</p>
        <p className="text-[10px] text-text-secondary">by {mentor}</p>
      </div>
      <div className="space-y-2">
        <div className="h-1.5 bg-bg-base rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-teal to-accent-purple" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] font-mono text-accent-teal text-right">{progress}%</p>
      </div>
    </div>
  );
}


