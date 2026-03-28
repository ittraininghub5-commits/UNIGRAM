import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/src/lib/supabase';
import { Course, CourseMaterial, Quiz, QuizQuestion } from '@/src/types';
import { 
  Play, 
  FileText, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  Clock, 
  Users, 
  BookOpen, 
  ArrowLeft,
  Lock,
  Sparkles,
  X,
  CheckCircle,
  AlertCircle,
  Trophy,
  Download,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [enrollment, setEnrollment] = useState<any | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [certificate, setCertificate] = useState<any | null>(null);
  const [generatingCert, setGeneratingCert] = useState(false);
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && id) {
        fetchEnrollment(session.user.id, id);
        fetchCertificate(session.user.id, id);
      }
    });

    fetchCourseData();
  }, [id]);

  const fetchCertificate = async (userId: string, courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('student_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (error) throw error;
      setCertificate(data);
    } catch (error) {
      console.error('Error fetching certificate:', error);
    }
  };

  const fetchEnrollment = async (userId: string, courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course_progress (*)
        `)
        .eq('student_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setEnrollment(data);
        const progMap: Record<string, boolean> = {};
        data.course_progress?.forEach((p: any) => {
          progMap[p.material_id] = p.completed;
        });
        setProgress(progMap);
      }
    } catch (error) {
      console.error('Error fetching enrollment:', error);
    }
  };

  const fetchCourseData = async () => {
    if (!id) return;
    try {
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`*, mentor:profiles (*)`)
        .eq('id', id)
        .single();
      
      if (courseError) throw courseError;
      setCourse(courseData as Course);

      const { data: materialsData, error: materialsError } = await supabase
        .from('course_materials')
        .select('*')
        .eq('course_id', id)
        .order('order_index', { ascending: true });
      
      if (materialsError) throw materialsError;
      setMaterials(materialsData as CourseMaterial[]);

      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select(`*, questions:quiz_questions (*)`)
        .eq('course_id', id);
      
      if (quizzesError) throw quizzesError;
      setQuizzes(quizzesData as Quiz[]);

    } catch (error: any) {
      console.error('Error fetching course data:', error);
      toast.error('Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!id) return;

    setEnrolling(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .insert([{
          student_id: user.id,
          course_id: id,
          progress_pct: 0,
          completed: false,
          enrolled_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      setEnrollment(data);
      toast.success('Enrolled successfully!');
    } catch (error: any) {
      console.error('Error enrolling:', error);
      toast.error('Failed to enroll in course');
    } finally {
      setEnrolling(false);
    }
  };

  const toggleMaterial = async (materialId: string, isQuiz: boolean = false) => {
    if (!enrollment || !user) return;
    
    const isCompleted = !progress[materialId];
    try {
      const { error } = await supabase
        .from('course_progress')
        .upsert({
          enrollment_id: enrollment.id,
          material_id: materialId,
          completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null
        }, { onConflict: 'enrollment_id,material_id' });
      
      if (error) throw error;

      const newProgress = { ...progress, [materialId]: isCompleted };
      setProgress(newProgress);
      
      const completedCount = Object.values(newProgress).filter(Boolean).length;
      const totalCount = materials.length + quizzes.length;
      const progressPct = Math.round((completedCount / totalCount) * 100);
      const isCourseCompleted = progressPct === 100;

      await supabase
        .from('enrollments')
        .update({ progress_pct: progressPct, completed: isCourseCompleted })
        .eq('id', enrollment.id);

      setEnrollment(prev => prev ? { ...prev, progress_pct: progressPct, completed: isCourseCompleted } : null);

      if (isCourseCompleted && !certificate) {
        toast.success("Congratulations! You've completed the course. You can now generate your certificate.");
      }

    } catch (error: any) {
      console.error('Error updating progress:', error);
      toast.error('Failed to update progress');
    }
  };

  const generateCertificateLocally = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const studentName = user.user_metadata?.full_name || user.email;
    const courseTitle = course.title;
    const mentorName = course.mentor?.full_name || "Unigram Mentor";

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

    doc.save(`${courseTitle.replace(/\s+/g, '_')}_Certificate.pdf`);
    toast.success('Certificate generated locally and downloaded!');
  };

  const generateCertificate = async () => {
    if (!enrollment || !course || !user || generatingCert) return;

    setGeneratingCert(true);
    try {
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          studentName: user.user_metadata?.full_name || user.email,
          courseTitle: course.title,
          mentorName: course.mentor?.full_name,
          mentorId: course.mentor_id,
          studentId: user.id,
          courseId: course.id
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn('Backend generation failed, falling back to local generation:', data.error);
        generateCertificateLocally();
        return;
      }

      setCertificate(data.certificate);
      toast.success('Certificate generated successfully!');
    } catch (error: any) {
      console.error('Error generating certificate, falling back to local generation:', error);
      generateCertificateLocally();
    } finally {
      setGeneratingCert(false);
    }
  };

  const debugCompleteCourse = async () => {
    if (!enrollment) return;
    
    try {
      const totalCount = materials.length + quizzes.length;
      const progUpdates = [
        ...materials.map(m => ({ enrollment_id: enrollment.id, material_id: m.id, completed: true, completed_at: new Date().toISOString() })),
        ...quizzes.map(q => ({ enrollment_id: enrollment.id, material_id: q.id, completed: true, completed_at: new Date().toISOString() }))
      ];

      const { error: progError } = await supabase
        .from('course_progress')
        .upsert(progUpdates, { onConflict: 'enrollment_id,material_id' });
      
      if (progError) throw progError;

      await supabase
        .from('enrollments')
        .update({ progress_pct: 100, completed: true })
        .eq('id', enrollment.id);

      setEnrollment(prev => prev ? { ...prev, progress_pct: 100, completed: true } : null);
      const progMap: Record<string, boolean> = {};
      progUpdates.forEach(p => progMap[p.material_id] = true);
      setProgress(progMap);
      
      toast.success('Debug: Course marked as completed!');
    } catch (error: any) {
      console.error('Debug error:', error);
      toast.error('Debug: Failed to complete course');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent-teal border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!course) return <div>Course not found</div>;

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <div className="relative h-[400px] overflow-hidden">
        <img 
          src={course.thumbnail_url || `https://picsum.photos/seed/${course.id}/1200/600`} 
          alt={course.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4 max-w-2xl">
              <div className="flex flex-wrap gap-2">
                {course.tags?.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-accent-teal/10 text-accent-teal text-[10px] font-mono uppercase tracking-wider rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tighter leading-tight">
                {course.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <img 
                    src={course.mentor?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${course.mentor?.id}`} 
                    className="w-6 h-6 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <span>{course.mentor?.full_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>2.4k Students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>4.5 Hours</span>
                </div>
              </div>
            </div>

            {!enrollment ? (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-8 py-4 rounded-2xl font-bold font-display transition-all shadow-lg shadow-accent-teal/20 flex items-center gap-2"
              >
                {enrolling ? 'Enrolling...' : 'Enroll Now'}
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="bg-bg-card border border-white/5 rounded-2xl p-4 min-w-[240px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-widest">Your Progress</span>
                  <span className="text-sm font-bold text-accent-teal">{enrollment.progress_pct}%</span>
                </div>
                <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${enrollment.progress_pct}%` }}
                    className="h-full bg-accent-teal"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-4">
            <h2 className="text-2xl font-display font-bold tracking-tight">About this course</h2>
            <p className="text-text-secondary leading-relaxed">
              {course.description || "No description provided for this course."}
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold tracking-tight">Curriculum</h2>
              <span className="text-xs font-mono text-text-muted uppercase tracking-widest">
                {materials.length + quizzes.length} Items
              </span>
            </div>

            <div className="space-y-3">
              {materials.map((material, index) => {
                const isLocked = !enrollment && index > 0;
                const isCompleted = progress[material.id];

                return (
                  <div 
                    key={material.id}
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      isLocked ? "bg-bg-card/50 border-white/5 opacity-60" : "bg-bg-card border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center">
                      {material.type === 'video' || material.type === 'youtube' ? (
                        <Play className="w-4 h-4 text-accent-teal" />
                      ) : (
                        <FileText className="w-4 h-4 text-accent-purple" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {material.title || `Lesson ${index + 1}`}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                          {material.type}
                        </span>
                        {material.duration_sec && (
                          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                            {Math.floor(material.duration_sec / 60)}m {material.duration_sec % 60}s
                          </span>
                        )}
                      </div>
                    </div>

                    {enrollment ? (
                      <button onClick={() => toggleMaterial(material.id)} className="flex-shrink-0">
                        {isCompleted ? <CheckCircle2 className="w-6 h-6 text-accent-teal" /> : <Circle className="w-6 h-6 text-text-muted hover:text-accent-teal transition-colors" />}
                      </button>
                    ) : (
                      isLocked ? <Lock className="w-5 h-5 text-text-muted" /> : <span className="text-[10px] font-mono text-accent-teal uppercase tracking-widest">Preview</span>
                    )}
                  </div>
                );
              })}

              {quizzes.map((quiz) => {
                const isCompleted = progress[quiz.id];
                return (
                  <div 
                    key={quiz.id}
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      !enrollment ? "bg-bg-card/50 border-white/5 opacity-60" : "bg-bg-card border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent-teal/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-accent-teal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">{quiz.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-mono text-accent-teal uppercase tracking-wider">AI Generated Quiz</span>
                        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{quiz.questions?.length} Questions</span>
                      </div>
                    </div>
                    {enrollment && (
                      <button 
                        onClick={() => isCompleted ? toggleMaterial(quiz.id) : setActiveQuiz(quiz)}
                        className="flex-shrink-0"
                      >
                        {isCompleted ? <CheckCircle2 className="w-6 h-6 text-accent-teal" /> : <button className="text-xs font-bold text-accent-teal hover:underline">Take Quiz</button>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-bg-card border border-white/5 rounded-3xl p-6 space-y-6">
            <h3 className="text-lg font-display font-bold">Course Features</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <BookOpen className="w-4 h-4 text-accent-teal" />
                <span>Full lifetime access</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <Users className="w-4 h-4 text-accent-teal" />
                <span>Community access</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <Clock className="w-4 h-4 text-accent-teal" />
                <span>Learn at your own pace</span>
              </li>
            </ul>
            
            <button
              onClick={generateCertificateLocally}
              className="w-full flex items-center justify-center gap-2 bg-bg-elevated border border-white/5 text-text-secondary py-3 rounded-2xl text-xs font-bold hover:bg-white/5 transition-all"
            >
              <FileText className="w-4 h-4" />
              Preview Certificate
            </button>
            
            {isLocalhost && enrollment && !enrollment.completed && (
              <button
                onClick={debugCompleteCourse}
                className="w-full flex items-center justify-center gap-2 bg-accent-amber/10 border border-accent-amber/20 text-accent-amber py-3 rounded-2xl text-[10px] font-mono uppercase tracking-widest hover:bg-accent-amber/20 transition-all"
              >
                Debug: Complete Course
              </button>
            )}
          </div>

          {enrollment?.completed && (
            <div className="bg-accent-teal/5 border border-accent-teal/20 rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-teal/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-accent-teal" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold">Course Certificate</h3>
                  <p className="text-xs text-text-secondary">You've earned a certificate!</p>
                </div>
              </div>

              {certificate ? (
                <div className="space-y-3">
                  <a 
                    href={certificate.certificate_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-accent-teal text-bg-base py-4 rounded-2xl font-bold font-display hover:bg-[#00f5b4] transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download Certificate
                  </a>
                  <button
                    onClick={generateCertificateLocally}
                    className="w-full flex items-center justify-center gap-2 bg-bg-elevated border border-white/5 text-text-secondary py-3 rounded-2xl text-xs font-bold hover:bg-white/5 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Regenerate Locally (Free)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={generateCertificate}
                    disabled={generatingCert}
                    className="w-full flex items-center justify-center gap-2 bg-accent-teal text-bg-base py-4 rounded-2xl font-bold font-display hover:bg-[#00f5b4] transition-all disabled:opacity-50"
                  >
                    {generatingCert ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Claim Certificate
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-text-muted">
                    Works offline & on localhost via client-side generation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {activeQuiz && (
          <QuizModal 
            quiz={activeQuiz} 
            onClose={() => setActiveQuiz(null)} 
            onComplete={() => {
              toggleMaterial(activeQuiz.id, true);
              setActiveQuiz(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QuizModal({ quiz, onClose, onComplete }: { quiz: Quiz; onClose: () => void; onComplete: () => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const questions = quiz.questions || [];
  const question = questions[currentQuestion];

  const handleNext = () => {
    if (selectedOption === question.correct_answer) {
      setScore(prev => prev + 1);
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedOption(null);
    } else {
      setShowResult(true);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-bg-card border border-white/10 rounded-[32px] w-full max-w-xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-accent-teal" />
            <h3 className="font-display font-bold">{quiz.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          {!showResult ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-mono text-text-muted uppercase tracking-widest">
                  <span>Question {currentQuestion + 1} of {questions.length}</span>
                  <span className="text-accent-teal">{question.difficulty}</span>
                </div>
                <h4 className="text-xl font-bold leading-tight">{question.question}</h4>
              </div>

              <div className="space-y-3">
                {question.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(i)}
                    className={cn(
                      "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                      selectedOption === i 
                        ? "bg-accent-teal/10 border-accent-teal text-accent-teal" 
                        : "bg-bg-elevated border-white/5 hover:border-white/10"
                    )}
                  >
                    <span className="text-sm font-medium">{option}</span>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center",
                      selectedOption === i ? "border-accent-teal bg-accent-teal" : "border-white/10"
                    )}>
                      {selectedOption === i && <div className="w-2 h-2 rounded-full bg-bg-base" />}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={selectedOption === null}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold font-display transition-all",
                  selectedOption === null 
                    ? "bg-white/5 text-text-muted cursor-not-allowed" 
                    : "bg-accent-teal text-bg-base hover:bg-[#00f5b4]"
                )}
              >
                {currentQuestion === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-8 py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent-teal/10 text-accent-teal mb-4">
                {score === questions.length ? <Trophy className="w-10 h-10" /> : <CheckCircle className="w-10 h-10" />}
              </div>
              <div className="space-y-2">
                <h4 className="text-3xl font-display font-extrabold">Quiz Completed!</h4>
                <p className="text-text-secondary">You scored {score} out of {questions.length}</p>
              </div>
              
              {score / questions.length >= 0.6 ? (
                <div className="p-4 bg-accent-teal/10 border border-accent-teal/20 rounded-2xl flex items-center gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-accent-teal shrink-0" />
                  <p className="text-xs text-accent-teal">Great job! You've passed the quiz and earned progress towards your certificate.</p>
                </div>
              ) : (
                <div className="p-4 bg-accent-amber/10 border border-accent-amber/20 rounded-2xl flex items-center gap-3 text-left">
                  <AlertCircle className="w-5 h-5 text-accent-amber shrink-0" />
                  <p className="text-xs text-accent-amber">You didn't pass this time. Review the material and try again to earn your certificate.</p>
                </div>
              )}

              <button
                onClick={onComplete}
                className="w-full bg-accent-teal hover:bg-[#00f5b4] text-bg-base py-4 rounded-2xl font-bold font-display transition-all"
              >
                Continue to Course
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
