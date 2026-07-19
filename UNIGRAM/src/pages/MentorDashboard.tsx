import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Profile, Course, CertificateRequest } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { cn, getInitials } from '@/src/lib/utils';
import { isMentorRole } from '@/src/lib/roles';
import { BookOpen, Trophy, Star, MoreHorizontal, Clock, Sparkles, FileText, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import { generateQuizFromContent, generateTagsFromContent, generateCourseMetadataFromTitle } from '@/src/services/aiService';

interface MentorDashboardProps {
  profile: Profile | null;
}

type PendingApprovalItem = {
  id: string;
  enrollment_id: string;
  student_id: string;
  mentor_id: string;
  course_id: string;
  requested_at: string;
  student?: any;
  course?: any;
  isFallback?: boolean;
};

export default function MentorDashboard({ profile }: MentorDashboardProps) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadContent, setUploadContent] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [pendingCertRequests, setPendingCertRequests] = useState<PendingApprovalItem[]>([]);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [newCourseTags, setNewCourseTags] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllCertificates, setShowAllCertificates] = useState(false);
  const [contentType, setContentType] = useState<'text' | 'pdf' | 'video'>('text');
  const [processorFile, setProcessorFile] = useState<File | null>(null);
  const [generatingCourseMeta, setGeneratingCourseMeta] = useState(false);
  const [autofillingCourseMeta, setAutofillingCourseMeta] = useState(false);
  const [certificateRequestsAvailable, setCertificateRequestsAvailable] = useState(true);
  const hasShownOptionalDataWarning = useRef(false);

  const formatFileSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

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

        if (!coursesData || coursesData.length === 0) {
          setEnrollments([]);
          setCertificates([]);
          setPendingCertRequests([]);
          setSelectedCourseId('');
          return;
        }
        
        setSelectedCourseId((prev) => {
          if (prev && coursesData.some((course) => course.id === prev)) {
            return prev;
          }
          return coursesData[0].id;
        });
        const courseIds = coursesData.map(c => c.id);

        const [enrollResult, certResult, requestsResult] = await Promise.all([
          supabase
            .from('enrollments')
            .select(`*, student:profiles (*), course:courses (*)`)
            .in('course_id', courseIds)
            .order('enrolled_at', { ascending: false }),
          supabase
            .from('certificates')
            .select(`*, student:profiles (*), course:courses (*)`)
            .in('course_id', courseIds)
            .order('issue_date', { ascending: false }),
          supabase
            .from('certificate_requests')
            .select(`*, student:profiles(*), course:courses(*)`)
            .eq('mentor_id', profile.id)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false }),
        ]);

        if (enrollResult.error) {
          console.error('Mentor dashboard enrollments error:', enrollResult.error);
          setEnrollments([]);
        } else {
          setEnrollments(enrollResult.data || []);
        }

        if (certResult.error) {
          console.error('Mentor dashboard certificates error:', certResult.error);
          setCertificates([]);
        } else {
          setCertificates(certResult.data || []);
        }

        if (requestsResult.error) {
          console.error('Mentor dashboard certificate requests error:', requestsResult.error);
          const safeEnrollments = (enrollResult.data || []) as any[];
          const safeCertificates = (certResult.data || []) as any[];
          const issuedEnrollmentIds = new Set(
            safeCertificates
              .map((cert) => cert.enrollment_id)
              .filter(Boolean)
          );

          const fallbackApprovals: PendingApprovalItem[] = safeEnrollments
            .filter((enrollment) => enrollment.completed && !issuedEnrollmentIds.has(enrollment.id))
            .map((enrollment) => ({
              id: `fallback-${enrollment.id}`,
              enrollment_id: enrollment.id,
              student_id: enrollment.student_id,
              mentor_id: profile.id,
              course_id: enrollment.course_id,
              requested_at: enrollment.enrolled_at || new Date().toISOString(),
              student: enrollment.student,
              course: enrollment.course,
              isFallback: true,
            }));
          setPendingCertRequests(fallbackApprovals);

          const missingTable = requestsResult.error.code === '42P01'
            || String(requestsResult.error.message || '').toLowerCase().includes('certificate_requests');

          if (missingTable) {
            setCertificateRequestsAvailable(false);
          } else {
            setCertificateRequestsAvailable(true);
            if (!hasShownOptionalDataWarning.current) {
              toast.warning('Could not load pending certificate requests right now.');
              hasShownOptionalDataWarning.current = true;
            }
          }
        } else {
          setCertificateRequestsAvailable(true);
          setPendingCertRequests((requestsResult.data || []) as PendingApprovalItem[]);
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

    const certRequestsChannel = certificateRequestsAvailable
      ? supabase
          .channel('mentor_certificate_requests')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'certificate_requests', filter: `mentor_id=eq.${profile.id}` }, () => fetchMentorData())
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(coursesChannel);
      if (certRequestsChannel) {
        supabase.removeChannel(certRequestsChannel);
      }
    };
  }, [profile, certificateRequestsAvailable]);

  useEffect(() => {
    if (!showCreateCourse) {
      return;
    }

    const title = newCourseTitle.trim();
    if (!title || generatingCourseMeta || autofillingCourseMeta) {
      return;
    }

    if (newCourseDescription.trim() && newCourseTags.trim()) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setAutofillingCourseMeta(true);
      try {
        const aiMeta = await generateCourseMetadataFromTitle(title);

        if (!newCourseDescription.trim() && aiMeta.description) {
          setNewCourseDescription(aiMeta.description);
        }

        if (!newCourseTags.trim() && aiMeta.tags.length > 0) {
          setNewCourseTags(aiMeta.tags.join(', '));
        }
      } catch (error) {
        console.error('AI course metadata autofill failed:', error);
      } finally {
        setAutofillingCourseMeta(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    showCreateCourse,
    newCourseTitle,
    newCourseDescription,
    newCourseTags,
    generatingCourseMeta,
    autofillingCourseMeta,
  ]);

  const handleCreateCourse = async () => {
    if (!profile?.id) return;

    const title = newCourseTitle.trim();
    if (!title) {
      toast.error('Course title is required.');
      return;
    }

    setCreatingCourse(true);
    try {
      let descriptionValue = newCourseDescription.trim();
      let tags = newCourseTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (!descriptionValue || tags.length === 0) {
        setGeneratingCourseMeta(true);
        const aiMeta = await generateCourseMetadataFromTitle(title);
        if (!descriptionValue) {
          descriptionValue = aiMeta.description;
          setNewCourseDescription(aiMeta.description);
        }
        if (tags.length === 0) {
          tags = aiMeta.tags;
          setNewCourseTags(aiMeta.tags.join(', '));
        }
      }

      const { data, error } = await supabase
        .from('courses')
        .insert([{
          mentor_id: profile.id,
          title,
          description: descriptionValue || null,
          tags: tags.length > 0 ? tags : null,
          status: 'live',
          modules_count: 0,
          videos_count: 0,
          ai_processed: false,
        }])
        .select('*')
        .single();

      if (error) throw error;

      setCourses((prev) => [data as Course, ...prev]);
      setSelectedCourseId(data.id);
      setShowCreateCourse(false);
      setNewCourseTitle('');
      setNewCourseDescription('');
      setNewCourseTags('');
      toast.success('Course created and published successfully.');
    } catch (error: any) {
      console.error('Error creating course:', error);
      toast.error(error.message || 'Failed to create course');
    } finally {
      setCreatingCourse(false);
      setGeneratingCourseMeta(false);
    }
  };

  const handleApproveCertificateRequest = async (request: PendingApprovalItem) => {
    if (!profile?.id) return;

    const noteInput = window.prompt('Add optional approval notes for the student:', 'Approved. Great work completing the course.');
    if (noteInput === null) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const response = request.isFallback || !certificateRequestsAvailable
        ? await fetch('/api/generate-certificate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              enrollmentId: request.enrollment_id,
              studentName: request.student?.full_name || request.student?.email || 'Student',
              courseTitle: request.course?.title || 'Course',
              mentorName: profile.full_name || 'Mentor',
              mentorId: profile.id,
              studentId: request.student_id,
              courseId: request.course_id,
            }),
          })
        : await fetch(`/api/certificate-requests/${request.id}/approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ mentorNotes: noteInput.trim() || null }),
          });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to approve request');
      }

      setPendingCertRequests((prev) => prev.filter((item) => item.id !== request.id));
      if (data?.certificate) {
        setCertificates((prev) => [data.certificate, ...prev]);
      }
      toast.success('Certificate approved and generated.');
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(error.message || 'Failed to approve certificate request');
    }
  };

  const handleRejectCertificateRequest = async (request: PendingApprovalItem) => {
    if (!profile?.id) return;

    if (request.isFallback || !certificateRequestsAvailable) {
      setPendingCertRequests((prev) => prev.filter((item) => item.id !== request.id));
      toast.success('Removed from approval queue.');
      return;
    }

    const noteInput = window.prompt('Add optional rejection notes for the student:', 'Please complete all required modules before requesting approval.');
    if (noteInput === null) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const response = await fetch(`/api/certificate-requests/${request.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mentorNotes: noteInput.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to reject request');
      }

      setPendingCertRequests((prev) => prev.filter((item) => item.id !== request.id));
      toast.success('Certificate request rejected. Student can re-apply after improvements.');
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(error.message || 'Failed to reject certificate request');
    }
  };

  const handleAIProcess = async () => {
    const textMode = contentType === 'text';
    const uploadMode = contentType === 'pdf' || contentType === 'video';

    if (textMode && !uploadContent.trim()) {
      toast.error('Please paste some content to process.');
      return;
    }
    if (uploadMode && !processorFile) {
      toast.error(`Please upload a ${contentType.toUpperCase()} file first.`);
      return;
    }
    if (!selectedCourseId) {
      toast.error('Please select a course');
      return;
    }

    const targetCourse = courses.find((c) => c.id === selectedCourseId);
    if (!targetCourse) {
      toast.error('Selected course was not found.');
      return;
    }

    if (uploadMode && profile?.id) {
      const isPdf = contentType === 'pdf';
      const isVideo = contentType === 'video';
      const mime = processorFile?.type || '';

      if (isPdf && !(mime === 'application/pdf' || processorFile?.name.toLowerCase().endsWith('.pdf'))) {
        toast.error('Please upload a valid PDF file.');
        return;
      }

      if (isVideo && !mime.startsWith('video/')) {
        toast.error('Please upload a valid video file.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      let sourceForAI = uploadContent.trim();

      if (uploadMode && processorFile && profile?.id) {
        const safeName = processorFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${selectedCourseId}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase
          .storage
          .from('course-content')
          .upload(path, processorFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase
          .storage
          .from('course-content')
          .getPublicUrl(path);

        const fileUrl = publicData.publicUrl;
        const inferredTitle = processorFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || processorFile.name;
        const metadata = await generateCourseMetadataFromTitle(inferredTitle);
        const generatedTags = await generateTagsFromContent(`${inferredTitle}\n${uploadContent.trim()}\n${targetCourse.title}`);
        const materialType = contentType === 'video' ? 'video' : 'document';

        const { error: materialError } = await supabase
          .from('course_materials')
          .insert({
            course_id: selectedCourseId,
            mentor_id: profile.id,
            type: materialType,
            title: inferredTitle,
            file_url: fileUrl,
            description: uploadContent.trim() || metadata.description || null,
            summary: metadata.description || null,
            ai_tags: generatedTags,
            duration_sec: null,
            processed: true,
          });

        if (materialError) throw materialError;

        if (contentType === 'video') {
          const { error: videoError } = await supabase
            .from('videos')
            .insert({
              mentor_id: profile.id,
              course_id: selectedCourseId,
              title: inferredTitle,
              description: uploadContent.trim() || metadata.description || null,
              video_url: fileUrl,
              duration_sec: null,
            });

          if (videoError) throw videoError;
        }

        sourceForAI = [
          `Uploaded ${contentType.toUpperCase()} file: ${processorFile.name}`,
          `Course: ${targetCourse.title}`,
          uploadContent.trim() ? `Mentor notes: ${uploadContent.trim()}` : '',
          metadata.description ? `Suggested summary: ${metadata.description}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }

      const processPromise = Promise.all([
        generateQuizFromContent(selectedCourseId, null, sourceForAI),
        generateTagsFromContent(sourceForAI)
      ]);

      toast.promise(processPromise, {
        loading: 'AI is analyzing your content and generating quizzes...',
        success: ([createdQuiz, createdTags]) => {
          return `Success! Generated quiz "${createdQuiz.title}" and ${createdTags.length} tags.`;
        },
        error: 'AI processing failed. Please try again.'
      });

      const [quiz, tags] = await processPromise;

      const mergedTags = Array.from(new Set([...(targetCourse?.tags || []), ...tags]))
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20);

      const { error: updateError } = await supabase
        .from('courses')
        .update({
          tags: mergedTags,
          ai_processed: true,
        })
        .eq('id', selectedCourseId)
        .eq('mentor_id', profile?.id || '');

      if (updateError) throw updateError;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === selectedCourseId
            ? { ...course, tags: mergedTags, ai_processed: true }
            : course
        )
      );

      setUploadContent('');
      setProcessorFile(null);
      toast.success(`Saved ${tags.length} generated tags to course and added quiz "${quiz.title}".`);
    } catch (error) {
      console.error('AI Processing error:', error);
      toast.error('AI processing failed. Please check file type/content and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const visibleCourses = showAllCourses ? courses : courses.slice(0, 8);
  const visibleEnrollments = showAllStudents ? enrollments : enrollments.slice(0, 5);
  const visibleCertificates = showAllCertificates ? certificates : certificates.slice(0, 5);

  const getCourseContentStoragePath = (url: string): string | null => {
    const marker = '/course-content/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!profile?.id) return;

    const ok = window.confirm(`Delete course "${course.title}"? This removes materials, quizzes, and related feed videos.`);
    if (!ok) return;

    try {
      const { data: materials } = await supabase
        .from('course_materials')
        .select('file_url')
        .eq('course_id', course.id)
        .eq('mentor_id', profile.id);

      const paths = (materials || [])
        .map((m: any) => (m.file_url ? getCourseContentStoragePath(m.file_url) : null))
        .filter(Boolean) as string[];

      if (paths.length > 0) {
        await supabase.storage.from('course-content').remove(paths);
      }

      await supabase
        .from('videos')
        .delete()
        .eq('mentor_id', profile.id)
        .eq('course_id', course.id);

      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id)
        .eq('mentor_id', profile.id);

      if (error) throw error;

      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      setEnrollments((prev) => prev.filter((e) => e.course_id !== course.id));
      setCertificates((prev) => prev.filter((c) => c.course_id !== course.id));
      setPendingCertRequests((prev) => prev.filter((r) => r.course_id !== course.id));
      setSelectedCourseId((prev) => (prev === course.id ? '' : prev));
      toast.success('Course deleted successfully.');
    } catch (error: any) {
      console.error('Error deleting course:', error);
      toast.error(error.message || 'Failed to delete course.');
    }
  };

  if (loading) return <div className="p-20 text-center">Loading dashboard...</div>;

  if (!profile || !isMentorRole(profile.role)) {
    return <div className="p-20 text-center text-text-secondary">Mentor access required.</div>;
  }

  return (
    <div className="pt-24 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Good morning, <span className="text-accent-teal">{profile?.full_name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-text-secondary text-sm">Here's what's happening with your courses today</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/new-course')}
            className="bg-accent-teal hover:brightness-110 text-bg-base px-5 py-2.5 rounded-xl text-sm font-bold font-display transition-all flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" /> New Course
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
          value={certificates.length.toLocaleString()} 
          label="Certs Issued" 
          change={`${certificates.filter(c => new Date(c.issue_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week`} 
          color="amber" 
        />
        <StatCard 
          icon={<Star className="w-5 h-5" />} 
          value={pendingCertRequests.length.toString()} 
          label="Pending Approvals" 
          change={certificateRequestsAvailable ? 'mentor verification queue' : 'auto-detected from completed enrollments'} 
          color="blue" 
        />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_460px] gap-8 lg:gap-10 items-start">
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
                      <button
                        onClick={() => {
                          setContentType('text');
                          setProcessorFile(null);
                        }}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                          contentType === 'text'
                            ? "bg-accent-teal/10 border border-accent-teal/20 text-accent-teal"
                            : "bg-white/5 border border-white/5 text-text-muted hover:bg-white/10"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5" /> Text
                      </button>
                      <button
                        onClick={() => {
                          setContentType('pdf');
                          setProcessorFile(null);
                        }}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                          contentType === 'pdf'
                            ? "bg-accent-teal/10 border border-accent-teal/20 text-accent-teal"
                            : "bg-white/5 border border-white/5 text-text-muted hover:bg-white/10"
                        )}
                      >
                        <Upload className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button
                        onClick={() => {
                          setContentType('video');
                          setProcessorFile(null);
                        }}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all",
                          contentType === 'video'
                            ? "bg-accent-teal/10 border border-accent-teal/20 text-accent-teal"
                            : "bg-white/5 border border-white/5 text-text-muted hover:bg-white/10"
                        )}
                      >
                        <Video className="w-3.5 h-3.5" /> Video
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">
                    {contentType === 'text' ? 'Content to Process' : 'File to Upload'}
                  </label>
                  {contentType === 'text' ? (
                    <textarea 
                      value={uploadContent}
                      onChange={(e) => setUploadContent(e.target.value)}
                      placeholder="Paste your course notes, transcript, or content here..."
                      className="w-full bg-bg-elevated border border-white/5 rounded-2xl py-4 px-4 text-sm outline-none focus:border-accent-teal transition-all min-h-[160px] resize-none"
                    />
                  ) : (
                    <input
                      type="file"
                      accept={contentType === 'pdf' ? '.pdf,application/pdf' : 'video/*'}
                      onChange={(e) => setProcessorFile(e.target.files?.[0] || null)}
                      className="w-full bg-bg-elevated border border-white/5 rounded-2xl py-3 px-4 text-sm outline-none focus:border-accent-teal transition-all"
                    />
                  )}
                </div>

                {contentType !== 'text' && processorFile && (
                  <div className="bg-bg-elevated/60 border border-white/5 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{processorFile.name}</p>
                      <p className="text-[11px] text-text-secondary">
                        {contentType.toUpperCase()} • {formatFileSize(processorFile.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProcessorFile(null)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all self-start sm:self-auto"
                    >
                      Remove File
                    </button>
                  </div>
                )}

                {contentType !== 'text' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest ml-1">Optional Context for AI</label>
                    <textarea 
                      value={uploadContent}
                      onChange={(e) => setUploadContent(e.target.value)}
                      placeholder="Add notes/context to improve generated quiz and tags..."
                      className="w-full bg-bg-elevated border border-white/5 rounded-2xl py-3 px-4 text-sm outline-none focus:border-accent-teal transition-all min-h-[96px] resize-none"
                    />
                  </div>
                )}

                <button 
                  onClick={handleAIProcess}
                  disabled={
                    isProcessing ||
                    !selectedCourseId ||
                    (contentType === 'text' && !uploadContent.trim()) ||
                    (contentType !== 'text' && !processorFile)
                  }
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
              <button
                onClick={() => setShowAllCourses((prev) => !prev)}
                className="text-xs font-bold text-accent-teal hover:underline"
              >
                {showAllCourses ? 'Show Less' : 'View All'}
              </button>
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
                  {visibleCourses.map((course) => (
                    <tr
                      key={course.id}
                      className="group hover:bg-bg-elevated/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/course/${course.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold group-hover:text-accent-teal transition-colors">{course.title}</p>
                          <p className="text-[10px] text-text-secondary">{course.modules_count} modules • {course.videos_count} videos</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-text-secondary">
                          {enrollments.filter(e => e.course_id === course.id).length}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-24 space-y-1.5">
                          <div className="h-1 bg-bg-base rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent-teal"
                              style={{
                                width: `${Math.round(
                                  enrollments.filter(e => e.course_id === course.id).reduce((sum, e) => sum + (e.progress_pct || 0), 0) /
                                    Math.max(enrollments.filter(e => e.course_id === course.id).length, 1)
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-[9px] font-mono text-text-muted text-right">
                            {Math.round(
                              enrollments.filter(e => e.course_id === course.id).reduce((sum, e) => sum + (e.progress_pct || 0), 0) /
                                Math.max(enrollments.filter(e => e.course_id === course.id).length, 1)
                            )}% avg progress
                          </p>
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/course/${course.id}`);
                            }}
                            className="p-2 text-text-muted hover:text-text-primary transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteCourse(course);
                            }}
                            className="text-[10px] font-bold text-accent-amber hover:underline"
                          >
                            Delete
                          </button>
                        </div>
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
              <button
                onClick={() => setShowAllStudents((prev) => !prev)}
                className="text-xs font-bold text-accent-teal hover:underline"
              >
                {showAllStudents ? 'Show Less' : 'View All'}
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {enrollments.length > 0 ? (
                visibleEnrollments.map((enrollment, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 hover:bg-bg-elevated/50 transition-colors cursor-pointer">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs",
                      enrollment.student?.avatar_url ? "" : "bg-accent-teal/10 text-accent-teal"
                    )}>
                      {enrollment.student?.avatar_url ? (
                        <>
                          <img
                            src={enrollment.student.avatar_url}
                            className="w-full h-full rounded-full object-cover"
                            alt={enrollment.student?.full_name || 'Student'}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <span style={{ display: 'none' }}>
                            {getInitials(enrollment.student?.full_name || 'Student')}
                          </span>
                        </>
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
              <button
                onClick={() => setShowAllCertificates((prev) => !prev)}
                className="text-xs font-bold text-accent-teal hover:underline"
              >
                {showAllCertificates ? 'Show Less' : 'View All'}
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {certificates.length > 0 ? (
                visibleCertificates.map((cert, i) => (
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

          <section className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Pending Certificate Requests</h2>
              <span className="text-xs font-mono text-text-muted">{pendingCertRequests.length}</span>
            </div>
            {!certificateRequestsAvailable && (
              <div className="px-6 py-3 border-b border-white/5 text-[11px] text-text-secondary bg-bg-elevated/30">
                Using fallback approval mode from completed enrollments (certificate_requests table not found).
              </div>
            )}
            <div className="divide-y divide-white/5">
              {pendingCertRequests.length === 0 ? (
                <div className="p-12 text-center text-sm text-text-secondary">No pending requests.</div>
              ) : (
                pendingCertRequests.slice(0, 8).map((request) => (
                  <div key={request.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent-teal/10 text-accent-teal flex items-center justify-center text-xs font-bold">
                      {getInitials(request.student?.full_name || 'Student')}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold leading-tight">{request.student?.full_name || 'Student'}</p>
                      <p className="text-[10px] text-text-secondary">{request.course?.title || 'Course'} • Requested {new Date(request.requested_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectCertificateRequest(request)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveCertificateRequest(request)}
                        className="bg-accent-teal hover:brightness-110 text-bg-base px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:max-w-[460px] lg:ml-auto w-full">
          {/* Realtime Activity Feed */}
          <div className="bg-bg-card border border-white/5 rounded-3xl p-7 lg:p-8 space-y-6 w-full">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em]">Activity</h3>
              <span className="text-[9px] font-mono text-text-muted">Realtime</span>
            </div>
            <div className="space-y-6 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
              {enrollments.slice(0, 4).map((enrollment, index) => (
                <ActivityItem
                  key={enrollment.id}
                  dotColor={index % 2 === 0 ? 'teal' : 'purple'}
                  text={`<strong>${enrollment.student?.full_name || 'Student'}</strong> enrolled in <strong>${enrollment.course?.title || 'your course'}</strong>`}
                  time={new Date(enrollment.enrolled_at).toLocaleDateString()}
                />
              ))}
              {enrollments.length === 0 && (
                <p className="text-xs text-text-secondary">No recent enrollment activity yet.</p>
              )}
            </div>
          </div>

          {/* Certificate Approval Summary */}
          <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-3xl p-7 lg:p-8 space-y-5 w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold">Certificate Approvals</h3>
                <p className="text-[10px] text-text-secondary">Pending mentor approvals</p>
              </div>
            </div>
            <div className="text-3xl font-display font-extrabold text-accent-amber">{pendingCertRequests.length}</div>
            <p className="text-xs text-text-secondary">
              {certificateRequestsAvailable ? 'Requests waiting for your review.' : 'Completed enrollments waiting for your certificate approval.'}
            </p>
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

