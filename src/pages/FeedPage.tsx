import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Profile, Video, Enrollment } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { getAIInsightForVideo, generateAIInsight, AIInsight as AIInsightType } from '@/src/services/aiService';
import { cn, getInitials } from '@/src/lib/utils';
import { Heart, MessageCircle, Share2, Play, Plus, BookOpen, Trophy, Search, Bell, Settings, CheckCircle2, ChevronRight, Sparkles, Loader2, Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';

interface FeedPageProps {
  profile: Profile | null;
}

export default function FeedPage({ profile }: FeedPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('For You');
  const [videos, setVideos] = useState<Video[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch Mentors
    const fetchMentors = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'mentor')
        .limit(5);
      
      if (error) {
        console.error('Error fetching mentors:', error);
      } else {
        setMentors(data as Profile[]);
      }
    };

    fetchMentors();
  }, []);

  useEffect(() => {
    setLoading(true);
    
    const fetchData = async () => {
      if (activeTab === 'My Courses') {
        if (profile) {
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
          } else {
            setEnrolledCourses(data);
          }
        }
        setLoading(false);
      } else {
        let query = supabase
          .from('videos')
          .select(`
            *,
            mentor:profiles (*),
            course:courses (*)
          `);

        if (activeTab === 'Trending') {
          query = query.order('likes_count', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query.limit(10);

        if (error) {
          console.error('Error fetching videos:', error);
        } else {
          setVideos(data as Video[]);
        }
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription for videos
    const subscription = supabase
      .channel('public:videos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeTab, profile]);

  return (
        <div className="pt-18 max-w-7xl mx-auto px-4 ...">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_300px] gap-8 items-start">
        
        {/* Left Sidebar */}
        <aside className="hidden lg:block sticky top-24 space-y-6">
          <div className="bg-bg-card border border-white/5 rounded-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-teal to-accent-purple flex items-center justify-center mx-auto text-xl font-bold text-bg-base">
              {profile ? getInitials(profile.full_name) : '??'}
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-sm">{profile?.full_name}</h3>
              <span className="inline-block px-2 py-0.5 rounded-md bg-accent-teal/10 text-accent-teal text-[10px] font-mono uppercase tracking-widest">
                {profile?.role}
              </span>
            </div>
            <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-2">
              <SidebarStat value={enrolledCourses.length.toString()} label="Courses" />
              <SidebarStat value={enrolledCourses.filter(e => e.completed).length.toString()} label="Certs" />
              <SidebarStat value={profile?.following_count?.toString() || "0"} label="Following" />
            </div>
          </div>

          <nav className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
            <SidebarNavItem 
              icon={<Plus className="w-4 h-4" />} 
              label="Feed" 
              active 
              onClick={() => navigate('/feed')}
            />
            <SidebarNavItem 
              icon={<BookOpen className="w-4 h-4" />} 
              label="My Courses"
              onClick={() => navigate('/courses')}
            />
            <SidebarNavItem 
              icon={<Trophy className="w-4 h-4" />} 
              label="Certificates"
              onClick={() => navigate('/certificates')}
            />
            <SidebarNavItem 
              icon={<Search className="w-4 h-4" />} 
              label="Search"
              onClick={() => navigate('/search')}
            />
            <SidebarNavItem 
              icon={<Gamepad2 className="w-4 h-4" />} 
              label="Game"
              onClick={() => navigate('/games')}
            />
            <SidebarNavItem 
              icon={<Bell className="w-4 h-4" />} 
              label="Notifications"
              onClick={() => navigate('/notifications')}
            />
            <SidebarNavItem 
              icon={<Settings className="w-4 h-4" />} 
              label="Settings"
              onClick={() => navigate('/settings')}
            />
          </nav>
        </aside>

        {/* Main Feed */}
        <div className="space-y-8">
          {/* Stories */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {MOCK_STORIES.map((story, i) => (
              <button key={i} className="flex-shrink-0 group space-y-2 text-center w-20">
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-accent-teal to-accent-purple group-hover:scale-105 transition-transform">
                  <div className="w-full h-full rounded-full bg-bg-card border-2 border-bg-base flex items-center justify-center text-2xl">
                    {story.emoji}
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary truncate">{story.name}</p>
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex bg-bg-card border border-white/5 rounded-2xl p-1 gap-1">
            {['For You', 'Following', 'Trending', 'My Courses', 'Quiz'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-medium transition-all",
                  activeTab === tab ? "bg-bg-elevated text-text-primary" : "text-text-secondary hover:text-text-primary"
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
                {[1, 2, 3].map(i => <div key={i} className="h-[400px] bg-bg-card border border-white/5 rounded-3xl animate-pulse" />)}
              </div>
            ) : activeTab === 'My Courses' ? (
              enrolledCourses.length > 0 ? (
                enrolledCourses.map((enrollment) => (
                  <EnrolledCourseCard key={enrollment.id} enrollment={enrollment} />
                ))
              ) : (
                <div className="bg-bg-card border border-white/5 rounded-3xl p-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-bg-elevated rounded-full flex items-center justify-center mx-auto text-3xl">📚</div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-bold">No courses yet</h3>
                    <p className="text-text-secondary text-sm">Start your learning journey by enrolling in a course.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('Trending')}
                    className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-6 py-2.5 rounded-xl text-sm font-bold font-display transition-all"
                  >
                    Explore Courses
                  </button>
                </div>
              )
            ) : (
              videos.map((video) => (
                <PostCard key={video.id} video={video} />
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="hidden xl:block sticky top-24 space-y-6">
          <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Suggested Mentors</h3>
            <div className="space-y-4">
              {mentors.length > 0 ? mentors.map((mentor) => (
                <div key={mentor.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-accent-teal/10 text-accent-teal")}>
                      {getInitials(mentor.full_name)}
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
                  <button className="text-[10px] font-bold text-accent-teal bg-accent-teal/10 px-3 py-1.5 rounded-lg hover:bg-accent-teal hover:text-bg-base transition-all">
                    Follow
                  </button>
                </div>
              )) : (
                <p className="text-[10px] text-text-muted text-center py-4">No mentors found</p>
              )}
            </div>
          </div>

          <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-6">
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

          <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Trending Topics</h3>
            <div className="flex flex-wrap gap-2">
              {['System Design', 'Machine Learning', 'React', 'Supabase', 'TypeScript', 'DSA', 'Cloud'].map(topic => (
                <span key={topic} className="px-3 py-1 rounded-lg bg-bg-elevated border border-white/5 text-[10px] text-text-secondary hover:text-accent-teal hover:border-accent-teal/30 cursor-pointer transition-all">
                  {topic}
                </span>
              ))}
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
      className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden group"
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
              <img 
                src={course.mentor?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${course.mentor?.id}`} 
                className="w-5 h-5 rounded-full"
                referrerPolicy="no-referrer"
              />
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

function SidebarNavItem({ 
  icon, 
  label, 
  active, 
  badge, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  badge?: number; 
  onClick?: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-sm transition-all border-b border-white/5 last:border-0",
        active ? "text-accent-teal bg-accent-teal/5" : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
      )}>
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="bg-accent-teal text-bg-base text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

function PostCard({ video }: { video: Video }) {
  const [liked, setLiked] = useState(false);
  const [insight, setInsight] = useState<AIInsightType | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

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
      className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden group"
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-teal/20 flex items-center justify-center text-xs font-bold text-accent-teal">
            {video.mentor ? getInitials(video.mentor.full_name) : '??'}
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
        <button className="text-[10px] font-bold text-accent-teal border border-accent-teal/20 px-4 py-1.5 rounded-xl hover:bg-accent-teal hover:text-bg-base transition-all">
          + Follow
        </button>
      </div>

      <div className="aspect-video bg-bg-elevated relative group/video cursor-pointer overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/5 to-accent-purple/5" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md border-2 border-white/20 flex items-center justify-center group-hover/video:scale-110 group-hover/video:bg-accent-teal group-hover/video:border-accent-teal transition-all">
            <Play className="w-6 h-6 fill-current text-white ml-1" />
          </div>
        </div>
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-lg bg-accent-teal/10 backdrop-blur-md border border-accent-teal/20 text-[10px] font-bold text-accent-teal uppercase tracking-widest">
            {video.course?.tags?.[0] || 'Learning'}
          </span>
        </div>
        <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/60 text-[10px] font-mono text-white">
          05:42
        </div>
      </div>

      <div className="p-6 space-y-4">
        <Link to={`/course/${video.course_id}`} className="block group/title">
          <h3 className="text-xl font-display font-bold leading-tight group-hover/title:text-accent-teal transition-colors">
            {video.title}
          </h3>
        </Link>
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
              className="flex items-center gap-2 text-[10px] font-bold text-accent-teal hover:text-[#00f5b4] transition-colors disabled:opacity-50"
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
                className="flex items-center gap-2 text-[10px] font-bold text-accent-teal hover:text-[#00f5b4] transition-colors"
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
            onClick={() => setLiked(!liked)}
            className={cn("flex items-center gap-2 text-xs transition-colors", liked ? "text-pink-500" : "text-text-secondary hover:text-text-primary")}
          >
            <Heart className={cn("w-4 h-4", liked && "fill-current")} /> {video.likes_count + (liked ? 1 : 0)}
          </button>
          <button className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <MessageCircle className="w-4 h-4" /> {video.comments_count}
          </button>
          <button className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        <Link 
          to={`/course/${video.course_id}`}
          className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-6 py-2 rounded-xl text-xs font-bold font-display transition-all flex items-center gap-1.5"
        >
          View Course <ChevronRight className="w-3.5 h-3.5" />
        </Link>
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

const MOCK_STORIES = [
  { emoji: '👩‍💻', name: 'Dr. Priya' },
  { emoji: '👨‍🏫', name: 'Rajesh' },
  { emoji: '🧑‍🔬', name: 'Kavya' },
  { emoji: '👷', name: 'Arjun' },
  { emoji: '🧑‍🎨', name: 'Meena' },
  { emoji: '🧑‍⚕️', name: 'Dinesh' },
];

const MOCK_MENTORS = [
  { name: 'Dr. Priya Nair', field: 'System Design', color: 'bg-[#004D3A] text-accent-teal' },
  { name: 'Rajesh Kumar', field: 'Machine Learning', color: 'bg-[#2D1B69] text-[#C4B5FD]' },
  { name: 'Anita Sharma', field: 'Product Design', color: 'bg-[#0D2757] text-[#93C5FD]' },
];

const MOCK_VIDEOS: Video[] = [
  {
    id: '1',
    mentor_id: 'm1',
    course_id: 'c1',
    title: 'Load Balancers Explained in 5 Minutes',
    description: 'A deep dive into horizontal vs vertical scaling strategies, round-robin algorithms, and when to choose each approach for production systems.',
    likes_count: 1243,
    comments_count: 84,
    video_url: null,
    thumbnail_url: null,
    duration_sec: 342,
    created_at: new Date().toISOString(),
    mentor: { id: 'm1', full_name: 'Dr. Priya Nair', institution: 'IIT Madras', followers_count: 2300 } as any,
    course: { tags: ['System Design', 'Distributed Systems', 'Backend'] } as any
  },
  {
    id: '2',
    mentor_id: 'm2',
    course_id: 'c2',
    title: 'Neural Networks 101 — The Math Behind AI',
    description: 'From perceptrons to backpropagation — a visual walkthrough of how modern neural networks learn, with live Python code examples.',
    likes_count: 2841,
    comments_count: 193,
    video_url: null,
    thumbnail_url: null,
    duration_sec: 497,
    created_at: new Date().toISOString(),
    mentor: { id: 'm2', full_name: 'Rajesh Kumar', institution: 'NIT Trichy', followers_count: 4100 } as any,
    course: { tags: ['Machine Learning', 'Deep Learning', 'Python'] } as any
  }
];