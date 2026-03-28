import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Profile, Course } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { cn, getInitials } from '@/src/lib/utils';
import { Plus, Video, BookOpen, Trophy, Star, MoreHorizontal, Upload, Clock, Sparkles, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { generateQuizFromContent, generateTagsFromContent } from '@/src/services/aiService';

interface MentorDashboardProps {
  profile: Profile | null;
}

export default function MentorDashboard({ profile }: MentorDashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadContent, setUploadContent] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  useEffect(() => {
    if (!profile) return;
    setLoading(true);

    const fetchMentorData = async () => {
      try {
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('mentor_id', profile.id)
          .order('created_at', { ascending: false });
        
        if (coursesError) throw coursesError;
        setCourses(coursesData as Course[]);
        
        if (coursesData && coursesData.length > 0) {
          setSelectedCourseId(coursesData[0].id);
          const courseIds = coursesData.map(c => c.id);
          const { data: enrollData, error: enrollError } = await supabase
            .from('enrollments')
            .select(`*, student:profiles (*), course:courses (*)`)
            .in('course_id', courseIds)
            .order('enrolled_at', { ascending: false });
          
          if (enrollError) throw enrollError;
          setEnrollments(enrollData || []);

          const { data: certData, error: certError } = await supabase
            .from('certificates')
            .select(`*, student:profiles (*), course:courses (*)`)
            .in('course_id', courseIds)
            .order('issue_date', { ascending: false });
          
          if (certError) throw certError;
          setCertificates(certData || []);
        }
      } catch (error: any) {
        console.error('Error fetching mentor data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchMentorData();
    const coursesChannel = supabase
      .channel('mentor_courses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses', filter: `mentor_id=eq.${profile.id}` }, () => fetchMentorData())
      .subscribe();

    return () => { supabase.removeChannel(coursesChannel); };
  }, [profile]);

  const handleAIProcess = async () => {
    if (!uploadContent.trim()) {
      toast.error('Please provide some content to process');
      return;
    }
    if (!selectedCourseId) {
      toast.error('Please select a course');
      return;
    }

    setIsProcessing(true);
    try {
      toast.promise(
        Promise.all([
          generateQuizFromContent(selectedCourseId, null, uploadContent),
          generateTagsFromContent(uploadContent)
        ]),
        {
          loading: 'AI is analyzing your content and generating quizzes...',
          success: ([quiz, tags]) => {
            setUploadContent('');
            return `Success! Generated quiz "${quiz.title}" and ${tags.length} tags.`;
          },
          error: 'AI processing failed. Please try again.'
        }
      );
    } catch (error) {
      console.error('AI Processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSampleCertificate = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const studentName = "Sample Student";
    const courseTitle = courses.find(c => c.id === selectedCourseId)?.title || "Sample Course";
    const mentorName = profile?.full_name || "Unigram Mentor";

    // Design
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // Border
    doc.setDrawColor(0, 217, 160); // #00D9A0
    doc.setLineWidth(1);
    doc.rect(10, 10, width - 20, height - 20);
    
    doc.setDrawColor(26, 35, 64); // #1A2340
    doc.setLineWidth(0.5);
    doc.rect(15, 15, width - 30, height - 30);

    // Content
    doc.setTextColor(26, 35, 64);
    doc.setFontSize(30);
    doc.setFont("helvetica", "bold");
    doc.text("CERTIFICATE OF COMPLETION", width / 2, 50, { align: "center" });

    doc.setFontSize(15);
    doc.setFont("helvetica", "normal");
    doc.text("This is to certify that", width / 2, 75, { align: "center" });

    doc.setTextColor(0, 217, 160);
    doc.setFontSize(25);
    doc.setFont("helvetica", "bold");
    doc.text(studentName, width / 2, 95, { align: "center" });

    doc.setTextColor(26, 35, 64);
    doc.setFontSize(15);
    doc.setFont("helvetica", "normal");
    doc.text("has successfully completed the course", width / 2, 115, { align: "center" });

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(courseTitle, width / 2, 130, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text(`Issued on ${new Date().toLocaleDateString()}`, width / 2, 155, { align: "center" });

    // Signatures
    doc.setDrawColor(26, 35, 64);
    doc.line(40, 180, 100, 180);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(mentorName, 70, 185, { align: "center" });
    doc.text("Course Mentor", 70, 190, { align: "center" });

    doc.line(width - 100, 180, width - 40, 180);
    doc.text("Unigram Academy", width - 70, 185, { align: "center" });
    doc.text("Authorized Signatory", width - 70, 190, { align: "center" });

    doc.save(`Sample_Certificate.pdf`);
    toast.success('Sample certificate generated and downloaded!');
  };

  if (loading) return <div className="p-20 text-center">Loading dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Good morning, <span className="text-accent-teal">{profile?.full_name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-text-secondary text-sm">Here's what's happening with your courses today</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all flex items-center gap-2">
            <Video className="w-4 h-4" /> Upload Video
          </button>
          <button className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-5 py-2.5 rounded-xl text-sm font-bold font-display transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Course
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<GraduationCapIcon />} 
          value={enrollments.length.toLocaleString()} 
          label="Total Students" 
          change={`${enrollments.filter(e => new Date(e.enrolled_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} new this week`} 
          color="teal" 
        />
        <StatCard 
          icon={<BookOpen className="w-5 h-5" />} 
          value={courses.filter(c => c.status === 'live').length.toString()} 
          label="Active Courses" 
          change={`${courses.filter(c => c.status === 'draft').length} in draft`} 
          color="purple" 
        />
        <StatCard 
          icon={<Trophy className="w-5 h-5" />} 
          value={enrollments.filter(e => e.completed).length.toLocaleString()} 
          label="Certs Issued" 
          change={`${enrollments.filter(e => e.completed && new Date(e.enrolled_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week`} 
          color="amber" 
        />
        <StatCard 
          icon={<Star className="w-5 h-5" />} 
          value="4.9" 
          label="Avg Rating" 
          change="from 4.8" 
          color="blue" 
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        {/* Main Content */}
        <div className="space-y-8">
          {/* AI Content Processor */}
          <section className="bg-bg-card border border-white/5 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Sparkles className="w-32 h-32 text-accent-teal" />
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-teal/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent-teal" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl">AI Content Processor</h2>
                  <p className="text-xs text-text-secondary">Upload your course material to automatically generate quizzes and tags</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Target Course</label>
                    <select 
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2.5 px-4 text-sm outline-none focus:border-accent-teal transition-all appearance-none"
                    >
                      {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Content Type</label>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 rounded-xl bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-bold flex items-center justify-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Text/PDF
                      </button>
                      <button className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/5 text-text-muted text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                        <Video className="w-3.5 h-3.5" /> Video
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Content to Process</label>
                  <textarea 
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    placeholder="Paste your course notes, transcript, or content here..."
                    className="w-full bg-bg-elevated border border-white/5 rounded-2xl py-4 px-4 text-sm outline-none focus:border-accent-teal transition-all min-h-[160px] resize-none"
                  />
                </div>

                <button 
                  onClick={handleAIProcess}
                  disabled={isProcessing || !uploadContent.trim()}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold font-display transition-all flex items-center justify-center gap-3 shadow-lg",
                    isProcessing 
                      ? "bg-white/5 text-text-muted cursor-not-allowed" 
                      : "bg-gradient-to-r from-accent-teal to-accent-purple text-bg-base hover:shadow-accent-teal/20"
                  )}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                      AI is thinking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Quiz & Tags
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Courses Table */}
          <section className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">My Courses</h2>
              <button className="text-xs font-bold text-accent-teal hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-mono text-text-muted uppercase tracking-widest border-b border-white/5">
                    <th className="px-6 py-4 font-medium">Course Name</th>
                    <th className="px-6 py-4 font-medium">Students</th>
                    <th className="px-6 py-4 font-medium">Progress</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {courses.map((course) => (
                    <tr key={course.id} className="group hover:bg-bg-elevated/50 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold group-hover:text-accent-teal transition-colors">{course.title}</p>
                          <p className="text-[10px] text-text-secondary">{course.modules_count} modules • {course.videos_count} videos</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-text-secondary">1,243</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-24 space-y-1.5">
                          <div className="h-1 bg-bg-base rounded-full overflow-hidden">
                            <div className="h-full bg-accent-teal" style={{ width: '88%' }} />
                          </div>
                          <p className="text-[9px] font-mono text-text-muted text-right">88% completion</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest",
                          course.status === 'live' ? "bg-accent-teal/10 text-accent-teal" : "bg-white/5 text-text-muted"
                        )}>
                          {course.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent Students */}
          <section className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Recent Student Activity</h2>
              <button className="text-xs font-bold text-accent-teal hover:underline">View All</button>
            </div>
            <div className="divide-y divide-white/5">
              {enrollments.length > 0 ? (
                enrollments.slice(0, 5).map((enrollment, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 hover:bg-bg-elevated/50 transition-colors cursor-pointer">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs",
                      enrollment.student?.avatar_url ? "" : "bg-accent-teal/10 text-accent-teal"
                    )}>
                      {enrollment.student?.avatar_url ? (
                        <img src={enrollment.student.avatar_url} className="w-full h-full rounded-full" />
                      ) : (
                        getInitials(enrollment.student?.full_name || 'Student')
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold leading-tight">{enrollment.student?.full_name}</p>
                      <p className="text-[10px] text-text-secondary">
                        {enrollment.course?.title} • Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-mono", enrollment.completed ? "text-accent-teal" : "text-text-secondary")}>
                        {enrollment.progress_pct}% {enrollment.completed ? '🎓' : ''}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center space-y-2">
                  <p className="text-sm text-text-secondary">No recent activity found.</p>
                </div>
              )}
            </div>
          </section>

          {/* Issued Certificates */}
          <section className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Issued Certificates</h2>
              <button className="text-xs font-bold text-accent-teal hover:underline">View All</button>
            </div>
            <div className="divide-y divide-white/5">
              {certificates.length > 0 ? (
                certificates.slice(0, 5).map((cert, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 hover:bg-bg-elevated/50 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-accent-amber" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold leading-tight">{cert.student?.full_name}</p>
                      <p className="text-[10px] text-text-secondary">
                        {cert.course?.title} • Issued {new Date(cert.issue_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <a 
                        href={cert.certificate_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-accent-teal hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> View PDF
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center space-y-2">
                  <p className="text-sm text-text-secondary">No certificates issued yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-6">
          {/* Activity Feed */}
          <div className="bg-bg-card border border-white/5 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Activity</h3>
              <span className="text-[9px] font-mono text-text-muted">Today</span>
            </div>
            <div className="space-y-6 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
              <ActivityItem dotColor="teal" text="<strong>Melvin Jose</strong> completed Full Stack Web Dev and earned a certificate" time="2 hrs ago" />
              <ActivityItem dotColor="purple" text="<strong>Denila Jeslena</strong> requested a job recommendation" time="5 hrs ago" />
              <ActivityItem dotColor="amber" text="<strong>Arjun Krishnan</strong> enrolled in System Design Fundamentals" time="8 hrs ago" />
              <ActivityItem dotColor="teal" text="<strong>23 new students</strong> joined your courses this week" time="Yesterday" />
            </div>
            <button className="w-full py-2.5 rounded-xl bg-bg-elevated border border-white/5 text-[10px] font-bold text-text-secondary hover:text-text-primary transition-all">
              View full activity log
            </button>
          </div>

          {/* Certificate Preview Card */}
          <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold">Certificate Preview</h3>
                <p className="text-[10px] text-text-secondary">Test the certificate design</p>
              </div>
            </div>
            <button 
              onClick={generateSampleCertificate}
              className="w-full py-3 rounded-xl bg-accent-amber text-bg-base text-xs font-bold hover:bg-[#ffbf00] transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Generate Sample
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, change, color }: { icon: React.ReactNode; value: string; label: string; change: string; color: 'teal' | 'purple' | 'amber' | 'blue' }) {
  const colors = {
    teal: 'before:bg-accent-teal',
    purple: 'before:bg-accent-purple',
    amber: 'before:bg-accent-amber',
    blue: 'before:bg-blue-400',
  };

  return (
    <div className={cn(
      "bg-bg-card border border-white/5 rounded-2xl p-5 relative overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-gradient-to-r before:from-current before:to-transparent",
      colors[color]
    )}>
      <div className="text-text-secondary mb-4">{icon}</div>
      <div className="space-y-1">
        <div className="text-2xl font-display font-extrabold tracking-tight">{value}</div>
        <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest">{label}</div>
      </div>
      <div className="mt-4 inline-block px-2 py-0.5 rounded bg-white/5 text-[9px] font-mono text-accent-teal">
        {change}
      </div>
    </div>
  );
}

function ActivityItem({ dotColor, text, time }: { dotColor: 'teal' | 'purple' | 'amber'; text: string; time: string }) {
  const colors = {
    teal: 'bg-accent-teal',
    purple: 'bg-accent-purple',
    amber: 'bg-accent-amber',
  };

  return (
    <div className="flex gap-4 relative z-10">
      <div className={cn("w-3.5 h-3.5 rounded-full border-2 border-bg-card mt-1 shrink-0", colors[dotColor])} />
      <div className="space-y-1">
        <p className="text-xs text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: text }} />
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted">
          <Clock className="w-3 h-3" /> {time}
        </div>
      </div>
    </div>
  );
}

function GraduationCapIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}
