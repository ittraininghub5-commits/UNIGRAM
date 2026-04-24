import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/src/lib/supabase';
import { Course, CourseMaterial, Quiz, QuizQuestion, CertificateRequest } from '@/src/types';
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
  ShieldCheck,
  Upload
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { cn, getInitials } from '@/src/lib/utils';
import { safeNavigateBack } from '@/src/lib/navigation';
import {
  GeneratedQuizDraft,
  createQuizFromDraft,
  generateCourseMetadataFromTitle,
  generateQuizDraftFromContent,
  generateQuizFromContent,
  generateTagsFromContent,
} from '@/src/services/aiService';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [certificateRequest, setCertificateRequest] = useState<CertificateRequest | null>(null);
  const [requestingCertificate, setRequestingCertificate] = useState(false);
  const [generatingCert, setGeneratingCert] = useState(false);
  const [studentsCount, setStudentsCount] = useState(0);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadDurationSec, setUploadDurationSec] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<CourseMaterial | null>(null);
  const [autofillingUploadMeta, setAutofillingUploadMeta] = useState(false);
  const [autoGenerateQuiz, setAutoGenerateQuiz] = useState(false);
  const [uploadQuizCount, setUploadQuizCount] = useState(3);
  const [uploadQuizDraft, setUploadQuizDraft] = useState<GeneratedQuizDraft | null>(null);
  const [quizDraftVerified, setQuizDraftVerified] = useState(false);
  const [generatingUploadQuiz, setGeneratingUploadQuiz] = useState(false);
  const [generatingMaterialQuizId, setGeneratingMaterialQuizId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && id) {
        fetchEnrollment(session.user.id, id);
        fetchCertificate(session.user.id, id);
        fetchCertificateRequest(session.user.id, id);
      }
    });

    fetchCourseData();
  }, [id]);

  useEffect(() => {
    if (!user?.id || !id) return;

    const certChannel = supabase
      .channel(`course-certificates-${id}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'certificates', filter: `student_id=eq.${user.id}` }, () => {
        fetchCertificate(user.id, id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'certificate_requests', filter: `student_id=eq.${user.id}` }, () => {
        fetchCertificateRequest(user.id, id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(certChannel);
    };
  }, [user?.id, id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`course-content-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_materials', filter: `course_id=eq.${id}` }, () => {
        fetchCourseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: `course_id=eq.${id}` }, () => {
        fetchCourseData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const fetchCertificateRequest = async (userId: string, courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('certificate_requests')
        .select('*')
        .eq('student_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      if (error) throw error;
      setCertificateRequest((data || null) as CertificateRequest | null);
    } catch (error) {
      console.error('Error fetching certificate request:', error);
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

      const { count: enrollmentCount, error: enrollmentCountError } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', id);

      if (enrollmentCountError) throw enrollmentCountError;
      setStudentsCount(enrollmentCount || 0);

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

      setEnrollment((prev: any) => prev ? { ...prev, progress_pct: progressPct, completed: isCourseCompleted } : null);

      if (isCourseCompleted && !certificate && !certificateRequest) {
        toast.success("Congratulations! You've completed the course. Request mentor approval for your certificate.");
      }

    } catch (error: any) {
      console.error('Error updating progress:', error);
      toast.error('Failed to update progress');
    }
  };

  const requestCertificateApproval = async () => {
    if (!enrollment || !course || !user || requestingCertificate) return;
    if (!enrollment.completed) {
      toast.error('Complete the course before requesting a certificate.');
      return;
    }

    setRequestingCertificate(true);
    try {
      const { data, error } = await supabase
        .from('certificate_requests')
        .upsert({
          enrollment_id: enrollment.id,
          student_id: user.id,
          mentor_id: course.mentor_id,
          course_id: course.id,
          status: 'pending',
          requested_at: new Date().toISOString(),
          reviewed_at: null,
          mentor_notes: null,
        }, { onConflict: 'enrollment_id' })
        .select('*')
        .single();

      if (error) throw error;
      setCertificateRequest(data as CertificateRequest);
      toast.success('Certificate request sent to mentor for approval.');
    } catch (error: any) {
      console.error('Certificate request error:', error);
      toast.error(error.message || 'Failed to request certificate approval');
    } finally {
      setRequestingCertificate(false);
    }
  };

  const generateCertificateLocally = () => {
    if (!course || !user) {
      toast.error('Course details are not ready yet.');
      return;
    }

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
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
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

  const inferMaterialType = (file: File): CourseMaterial['type'] => {
    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (mime.startsWith('video/')) return 'video';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (
      mime.includes('presentation') ||
      name.endsWith('.ppt') ||
      name.endsWith('.pptx')
    ) {
      return 'ppt';
    }
    return 'notebook';
  };

  const formatTitleFromFileName = (fileName: string): string => {
    const base = fileName.replace(/\.[^/.]+$/, '');
    return base
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const estimateDurationFromFile = async (file: File, type: CourseMaterial['type']): Promise<number | null> => {
    if (type === 'video') {
      try {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        const duration = await new Promise<number | null>((resolve) => {
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            const value = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
            URL.revokeObjectURL(url);
            resolve(value && value > 0 ? value : null);
          };
          video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
          };
          video.src = url;
        });
        return duration;
      } catch {
        return null;
      }
    }

    // Approximate reading/learning time for non-video materials.
    const sizeKb = file.size / 1024;
    if (type === 'pdf' || type === 'ppt') {
      return Math.max(180, Math.round(sizeKb * 1.2));
    }
    return Math.max(120, Math.round(sizeKb * 0.8));
  };

  const extractUploadSourceText = async (file: File): Promise<string> => {
    const lowerName = file.name.toLowerCase();
    const isTextLike =
      file.type.startsWith('text/') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv');

    if (!isTextLike) {
      return '';
    }

    try {
      const raw = await file.text();
      return raw.slice(0, 5000);
    } catch {
      return '';
    }
  };

  const handleGenerateUploadQuizDraft = async () => {
    if (!course || !uploadFile) {
      toast.error('Select a file first to generate quiz questions.');
      return;
    }

    const inferredTitle = formatTitleFromFileName(uploadFile.name) || uploadFile.name;
    const title = uploadTitle.trim() || inferredTitle;
    const fileText = await extractUploadSourceText(uploadFile);
    const sourceText = [
      `Course: ${course.title}`,
      `Material title: ${title}`,
      `Material description: ${uploadDescription.trim()}`,
      `Course description: ${course.description || ''}`,
      `File content preview: ${fileText}`,
    ]
      .filter(Boolean)
      .join('\n');

    setGeneratingUploadQuiz(true);
    setQuizDraftVerified(false);
    try {
      const draft = await generateQuizDraftFromContent(sourceText, uploadQuizCount);
      setUploadQuizDraft(draft);
      setAutoGenerateQuiz(true);
      toast.success(`AI generated ${draft.questions.length} quiz questions.`);
    } catch (error: any) {
      console.error('Error generating upload quiz draft:', error);
      toast.error(error.message || 'Failed to generate AI quiz draft.');
    } finally {
      setGeneratingUploadQuiz(false);
    }
  };

  const handleUploadFileChange = async (file: File | null) => {
    setUploadFile(file);
    setUploadQuizDraft(null);
    setQuizDraftVerified(false);
    if (!file) {
      return;
    }

    const detectedTitle = formatTitleFromFileName(file.name) || file.name;
    if (!uploadTitle.trim()) {
      setUploadTitle(detectedTitle);
    }

    setAutofillingUploadMeta(true);
    try {
      const type = inferMaterialType(file);
      const estimatedDuration = await estimateDurationFromFile(file, type);
      if (!uploadDurationSec.trim() && estimatedDuration && estimatedDuration > 0) {
        setUploadDurationSec(String(estimatedDuration));
      }

      if (!uploadDescription.trim()) {
        const aiMeta = await generateCourseMetadataFromTitle(detectedTitle);
        if (aiMeta.description) {
          setUploadDescription(aiMeta.description);
        }
      }
    } catch (error) {
      console.error('Failed to auto-fill upload metadata:', error);
    } finally {
      setAutofillingUploadMeta(false);
    }
  };

  const handleMentorUpload = async () => {
    if (!course || !user?.id) return;
    if (course.mentor_id !== user.id) {
      toast.error('Only the course mentor can upload content.');
      return;
    }

    if (!uploadFile) {
      toast.error('Select a file to upload.');
      return;
    }

    const inferredTitle = formatTitleFromFileName(uploadFile.name) || uploadFile.name;
    const title = uploadTitle.trim() || inferredTitle;
    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${course.id}/${Date.now()}-${safeName}`;
    const materialType = inferMaterialType(uploadFile);
    const manualDuration = uploadDurationSec.trim() ? Number(uploadDurationSec) : null;

    if (manualDuration !== null && (!Number.isFinite(manualDuration) || manualDuration < 0)) {
      toast.error('Duration must be a valid positive number of seconds.');
      return;
    }

    setUploadingFile(true);
    try {
      const { error: uploadError } = await supabase
        .storage
        .from('course-content')
        .upload(path, uploadFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase
        .storage
        .from('course-content')
        .getPublicUrl(path);

      const fileUrl = publicData.publicUrl;
      const durationSec = manualDuration ?? await estimateDurationFromFile(uploadFile, materialType);

      const aiMeta = await generateCourseMetadataFromTitle(title);
      const aiTags = await generateTagsFromContent(`${title}\n${aiMeta.description}\n${course.title}`);
      const finalDescription = uploadDescription.trim() || aiMeta.description;
      const finalSummary = aiMeta.description;

      const { data: insertedMaterial, error: materialError } = await supabase
        .from('course_materials')
        .insert({
          course_id: course.id,
          mentor_id: user.id,
          type: materialType,
          title,
          file_url: fileUrl,
          description: finalDescription || null,
          summary: finalSummary || null,
          ai_tags: aiTags,
          duration_sec: durationSec,
          order_index: materials.length + 1,
          processed: true,
        })
        .select('id')
        .single();

      if (materialError) throw materialError;

      if (materialType === 'video') {
        const { error: videoError } = await supabase
          .from('videos')
          .insert({
            mentor_id: user.id,
            course_id: course.id,
            title,
            description: finalDescription || null,
            video_url: fileUrl,
            duration_sec: durationSec,
          });

        if (videoError) throw videoError;
      }

      if (autoGenerateQuiz) {
        if (!uploadQuizDraft) {
          throw new Error('Generate AI quiz first before uploading with quiz enabled.');
        }
        if (!quizDraftVerified) {
          throw new Error('Please verify the generated quiz before uploading.');
        }

        try {
          await createQuizFromDraft(course.id, insertedMaterial.id, uploadQuizDraft);
          toast.success('AI quiz created and linked to this material.');
        } catch (quizError: any) {
          console.error('AI quiz generation after upload failed:', quizError);
          toast.warning('Content uploaded, but AI quiz generation failed. You can generate it again later.');
        }
      }

      setUploadTitle('');
      setUploadDescription('');
      setUploadDurationSec('');
      setUploadFile(null);
      setUploadQuizDraft(null);
      setQuizDraftVerified(false);
      setAutoGenerateQuiz(false);
      setSearchParams((prev) => {
        prev.delete('upload');
        return prev;
      });
      toast.success('Content uploaded and AI metadata generated successfully.');
      fetchCourseData();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGenerateQuizForMaterial = async (material: CourseMaterial) => {
    if (!course || !user?.id || !isMentorOwner) {
      toast.error('Only the course mentor can generate quizzes.');
      return;
    }

    const sourceText = [
      `Course: ${course.title}`,
      `Material title: ${material.title || 'Untitled material'}`,
      `Material description: ${material.description || ''}`,
      `Material summary: ${material.summary || ''}`,
      `Material tags: ${material.ai_tags?.join(', ') || ''}`,
      `Course description: ${course.description || ''}`,
      `Course tags: ${course.tags?.join(', ') || ''}`,
    ]
      .filter(Boolean)
      .join('\n');

    setGeneratingMaterialQuizId(material.id);
    try {
      const quiz = await generateQuizFromContent(course.id, material.id, sourceText);
      toast.success(`AI quiz "${quiz.title}" generated.`);
      await fetchCourseData();
    } catch (error: any) {
      console.error('Error generating quiz for material:', error);
      toast.error(error.message || 'Failed to generate quiz for this material.');
    } finally {
      setGeneratingMaterialQuizId(null);
    }
  };

  const getCourseContentStoragePath = (url: string): string | null => {
    const marker = '/course-content/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const handleDeleteMaterial = async (material: CourseMaterial) => {
    if (!course || !user?.id || !isMentorOwner) return;

    const ok = window.confirm(`Delete material "${material.title || 'Untitled'}"? This will also remove linked quizzes.`);
    if (!ok) return;

    try {
      if (material.file_url) {
        const path = getCourseContentStoragePath(material.file_url);
        if (path) {
          await supabase.storage.from('course-content').remove([path]);
        }
      }

      if (material.type === 'video' && material.file_url) {
        await supabase
          .from('videos')
          .delete()
          .eq('mentor_id', user.id)
          .eq('course_id', course.id)
          .eq('video_url', material.file_url);
      }

      const { error } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', material.id)
        .eq('mentor_id', user.id);

      if (error) throw error;
      toast.success('Material deleted successfully.');
      await fetchCourseData();
    } catch (error: any) {
      console.error('Error deleting material:', error);
      toast.error(error.message || 'Failed to delete material.');
    }
  };

  const handleDeleteQuiz = async (quiz: Quiz) => {
    if (!course || !user?.id || !isMentorOwner) return;

    const ok = window.confirm(`Delete quiz "${quiz.title}" and all its questions?`);
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quiz.id)
        .eq('course_id', course.id);

      if (error) throw error;
      toast.success('Quiz deleted successfully.');
      await fetchCourseData();
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      toast.error(error.message || 'Failed to delete quiz.');
    }
  };

  const totalDurationSec = materials.reduce((sum, material) => sum + (material.duration_sec || 0), 0);
  const totalDurationHours = (totalDurationSec / 3600).toFixed(1);
  const isMentorOwner = !!course && !!user && course.mentor_id === user.id;
  const uploadRequested = searchParams.get('upload') === '1';
  const totalItemsCount = materials.length + quizzes.length;
  const completedItemsCount = Object.values(progress).filter(Boolean).length;
  const currentProgressPct = enrollment?.progress_pct || 0;
  const canRequestCertificate = !!enrollment && currentProgressPct >= 100;

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
            onClick={() => safeNavigateBack(navigate, '/courses')}
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
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-accent-teal/20 flex items-center justify-center text-[9px] font-bold text-accent-teal">
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
                  <span>{course.mentor?.full_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{studentsCount.toLocaleString()} Students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{totalDurationHours} Hours</span>
                </div>
              </div>
            </div>

            {!enrollment ? (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="bg-accent-teal hover:brightness-110 text-bg-base px-8 py-4 rounded-2xl font-bold font-display transition-all shadow-lg shadow-accent-teal/20 flex items-center gap-2"
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
                <p className="mt-2 text-[10px] text-text-secondary">
                  {completedItemsCount}/{Math.max(totalItemsCount, 1)} items completed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {isMentorOwner && (
            <section className={cn(
              "space-y-4 bg-bg-card border border-white/5 rounded-3xl p-6",
              uploadRequested && "border-accent-teal/40"
            )}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-teal/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-accent-teal" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold">Upload Course Content</h2>
                  <p className="text-xs text-text-secondary">Add real video/docs to this course. Videos are also published in Feed.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Content title"
                  className="bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
                />
                <input
                  value={uploadDurationSec}
                  onChange={(e) => setUploadDurationSec(e.target.value)}
                  placeholder="Duration (seconds, optional)"
                  className="bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
                />
              </div>

              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Description"
                className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal min-h-[100px]"
              />

              <input
                type="file"
                accept="video/*,.pdf,.ppt,.pptx,.txt,.md"
                onChange={(e) => {
                  void handleUploadFileChange(e.target.files?.[0] || null);
                }}
                className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2 px-3 text-sm outline-none focus:border-accent-teal"
              />

              {autofillingUploadMeta && (
                <p className="text-[11px] text-text-secondary">AI is preparing title, description, and duration suggestions...</p>
              )}

              <div className="bg-bg-elevated/60 border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                  <p className="text-xs text-text-secondary">Create AI quiz from this upload</p>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-text-muted">Questions</label>
                    <select
                      value={uploadQuizCount}
                      onChange={(e) => setUploadQuizCount(Number(e.target.value) || 3)}
                      className="bg-bg-elevated border border-white/10 rounded-lg py-1.5 px-2 text-xs outline-none focus:border-accent-teal"
                    >
                      {[2, 3, 4, 5, 6, 8, 10].map((count) => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        void handleGenerateUploadQuizDraft();
                      }}
                      disabled={!uploadFile || generatingUploadQuiz || uploadingFile}
                      className="bg-accent-teal/20 text-accent-teal border border-accent-teal/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-accent-teal hover:text-bg-base transition-all disabled:opacity-50"
                    >
                      {generatingUploadQuiz ? 'Generating...' : 'Generate AI Quiz'}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={autoGenerateQuiz}
                    onChange={(e) => setAutoGenerateQuiz(e.target.checked)}
                    className="accent-accent-teal"
                  />
                  Attach generated quiz to this upload
                </label>

                {autoGenerateQuiz && uploadQuizDraft && (
                  <div className="space-y-3 bg-bg-card border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] font-mono text-accent-teal uppercase tracking-wider">Mentor Review</p>
                    <h4 className="text-sm font-bold">{uploadQuizDraft.title}</h4>
                    <div className="space-y-3 max-h-56 overflow-auto pr-1">
                      {uploadQuizDraft.questions.map((q, idx) => (
                        <div key={`${q.question}-${idx}`} className="bg-bg-elevated border border-white/5 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold">Q{idx + 1}. {q.question}</p>
                          <ul className="space-y-1">
                            {q.options.map((option, optIdx) => (
                              <li key={`${option}-${optIdx}`} className={cn(
                                'text-[11px] text-text-secondary',
                                optIdx === q.correct_answer && 'text-accent-teal font-semibold'
                              )}>
                                {optIdx + 1}. {option}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={quizDraftVerified}
                        onChange={(e) => setQuizDraftVerified(e.target.checked)}
                        className="accent-accent-teal"
                      />
                      I verified these questions and answers
                    </label>
                  </div>
                )}
              </div>

              <button
                onClick={handleMentorUpload}
                disabled={
                  uploadingFile ||
                  autofillingUploadMeta ||
                  !uploadFile ||
                  generatingUploadQuiz ||
                  (autoGenerateQuiz && (!uploadQuizDraft || !quizDraftVerified))
                }
                className="bg-accent-teal hover:brightness-110 text-bg-base px-6 py-3 rounded-xl text-sm font-bold font-display transition-all disabled:opacity-50"
              >
                {uploadingFile ? 'Uploading...' : 'Upload Content'}
              </button>
            </section>
          )}

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
                const hasFullContentAccess = !!enrollment || isMentorOwner;
                const isCompleted = progress[material.id];

                return (
                  <div 
                    key={material.id}
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      "bg-bg-card border-white/5 hover:border-white/10"
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

                    {(material.file_url || material.youtube_url) && (
                      hasFullContentAccess ? (
                        <a
                          href={material.youtube_url || material.file_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-accent-teal hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        <button
                          onClick={() => setPreviewMaterial(material)}
                          className="text-[10px] font-bold text-accent-teal hover:underline"
                        >
                          Preview
                        </button>
                      )
                    )}

                    {isMentorOwner && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleGenerateQuizForMaterial(material)}
                          disabled={generatingMaterialQuizId === material.id}
                          className="text-[10px] font-bold text-accent-teal hover:underline disabled:opacity-50"
                        >
                          {generatingMaterialQuizId === material.id ? 'Generating...' : 'Generate AI Quiz'}
                        </button>
                        <button
                          onClick={() => {
                            void handleDeleteMaterial(material);
                          }}
                          className="text-[10px] font-bold text-accent-amber hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {enrollment ? (
                      <button onClick={() => toggleMaterial(material.id)} className="flex-shrink-0">
                        {isCompleted ? <CheckCircle2 className="w-6 h-6 text-accent-teal" /> : <Circle className="w-6 h-6 text-text-muted hover:text-accent-teal transition-colors" />}
                      </button>
                    ) : isMentorOwner ? (
                      <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Mentor</span>
                    ) : (
                      <span className="text-[10px] font-mono text-accent-amber uppercase tracking-widest">Enroll for full access</span>
                    )}
                  </div>
                );
              })}

              {quizzes.map((quiz) => {
                const isCompleted = progress[quiz.id];
                const linkedMaterialCompleted = quiz.material_id ? !!progress[quiz.material_id] : true;
                const quizLocked = !isMentorOwner && (!enrollment || !linkedMaterialCompleted);
                return (
                  <div 
                    key={quiz.id}
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      quizLocked ? "bg-bg-card/50 border-white/5 opacity-60" : "bg-bg-card border-white/5 hover:border-white/10"
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
                        {quiz.material_id && !linkedMaterialCompleted && !isMentorOwner && (
                          <span className="text-[10px] font-mono text-accent-amber uppercase tracking-wider">Complete linked material to unlock</span>
                        )}
                      </div>
                    </div>

                    {isMentorOwner ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setActiveQuiz(quiz)}
                          className="flex-shrink-0 text-xs font-bold text-accent-teal hover:underline"
                        >
                          Edit Quiz
                        </button>
                        <button
                          onClick={() => {
                            void handleDeleteQuiz(quiz);
                          }}
                          className="flex-shrink-0 text-xs font-bold text-accent-amber hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    ) : enrollment && !quizLocked ? (
                      <button 
                        onClick={() => isCompleted ? toggleMaterial(quiz.id) : setActiveQuiz(quiz)}
                        className="flex-shrink-0"
                      >
                        {isCompleted ? <CheckCircle2 className="w-6 h-6 text-accent-teal" /> : <span className="text-xs font-bold text-accent-teal hover:underline">Take Quiz</span>}
                      </button>
                    ) : (
                      <Lock className="w-5 h-5 text-text-muted" />
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

            {isMentorOwner && (
              <button
                onClick={generateCertificateLocally}
                className="w-full flex items-center justify-center gap-2 bg-bg-elevated border border-white/5 text-text-secondary py-3 rounded-2xl text-xs font-bold hover:bg-white/5 transition-all"
              >
                <FileText className="w-4 h-4" />
                Preview Certificate
              </button>
            )}
            
          </div>

          {!!enrollment && !isMentorOwner && (
            <div className="bg-accent-teal/5 border border-accent-teal/20 rounded-3xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-teal/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-accent-teal" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold">Course Certificate</h3>
                  <p className="text-xs text-text-secondary">Reach 100% completion, then request mentor approval for your certificate.</p>
                </div>
              </div>

              <div className="bg-bg-card border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-widest">Completion</span>
                  <span className="text-sm font-bold text-accent-teal">{currentProgressPct}%</span>
                </div>
                <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-accent-teal" style={{ width: `${currentProgressPct}%` }} />
                </div>
                <p className="text-[11px] text-text-secondary">
                  {canRequestCertificate
                    ? 'You reached 100%. You can now request certificate approval.'
                    : `Complete all items to reach 100% and unlock certificate request.`}
                </p>
              </div>

              {certificate ? (
                <div className="space-y-3">
                  <a 
                    href={certificate.certificate_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-accent-teal text-bg-base py-4 rounded-2xl font-bold font-display hover:brightness-110 transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download Certificate
                  </a>
                  {isMentorOwner && (
                    <button
                      onClick={generateCertificateLocally}
                      className="w-full flex items-center justify-center gap-2 bg-bg-elevated border border-white/5 text-text-secondary py-3 rounded-2xl text-xs font-bold hover:bg-white/5 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Regenerate Locally (Free)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {certificateRequest?.status === 'pending' ? (
                    <div className="w-full flex items-center justify-center gap-2 bg-accent-amber/10 border border-accent-amber/20 text-accent-amber py-4 rounded-2xl text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Awaiting mentor approval
                    </div>
                  ) : (
                    <button
                      onClick={requestCertificateApproval}
                      disabled={requestingCertificate || !canRequestCertificate}
                      className="w-full flex items-center justify-center gap-2 bg-accent-teal text-bg-base py-4 rounded-2xl font-bold font-display hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {requestingCertificate ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending Request...
                        </>
                      ) : !canRequestCertificate ? (
                        <>
                          <Lock className="w-5 h-5" />
                          Complete 100% To Request
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5" />
                          Request Mentor Approval
                        </>
                      )}
                    </button>
                  )}
                  {certificateRequest?.status === 'rejected' && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-center text-accent-amber">
                        Previous request was rejected. You can submit a new request after improvements.
                      </p>
                      {certificateRequest.mentor_notes && (
                        <p className="text-[10px] text-center text-text-secondary">
                          Mentor note: {certificateRequest.mentor_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewMaterial && !enrollment && !isMentorOwner && (
          <MaterialPreviewModal
            material={previewMaterial}
            onClose={() => setPreviewMaterial(null)}
            onEnroll={() => {
              setPreviewMaterial(null);
              void handleEnroll();
            }}
          />
        )}
        {activeQuiz && (
          isMentorOwner ? (
            <MentorQuizEditorModal
              quiz={activeQuiz}
              onClose={() => setActiveQuiz(null)}
              onSaved={async () => {
                await fetchCourseData();
                setActiveQuiz(null);
              }}
            />
          ) : (
            <QuizModal 
              quiz={activeQuiz} 
              onClose={() => setActiveQuiz(null)} 
              onComplete={() => {
                if (enrollment && !isMentorOwner) {
                  toggleMaterial(activeQuiz.id, true);
                }
                setActiveQuiz(null);
              }} 
            />
          )
        )}
      </AnimatePresence>
    </div>
  );
}

function MaterialPreviewModal({
  material,
  onClose,
  onEnroll,
}: {
  material: CourseMaterial;
  onClose: () => void;
  onEnroll: () => void;
}) {
  const VIDEO_PREVIEW_SECONDS = 5 * 60;
  const [reachedLimit, setReachedLimit] = useState(false);

  const isVideo = material.type === 'video' || material.type === 'youtube';
  const hasContentUrl = !!material.youtube_url || !!material.file_url;

  const getYouTubeEmbedUrl = (url: string): string => {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
    const id = match?.[1];
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}?start=0&end=${VIDEO_PREVIEW_SECONDS}&rel=0`;
  };

  const previewSummary = material.summary || material.description || 'Preview pages 1-5 are available only after enrollment. Enroll to unlock the complete learning content.';
  const previewKeywords = (material.ai_tags || [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);

  const pagePreviewCards = (() => {
    const sectionLabels = ['Overview', 'Concept', 'Walkthrough', 'Practice', 'Recap'];
    const words = previewSummary
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    const chunkSize = Math.max(8, Math.ceil(words.length / 5));
    const chunks = Array.from({ length: 5 }).map((_, index) => {
      const start = index * chunkSize;
      const end = start + chunkSize;
      return words.slice(start, end).join(' ').trim();
    });

    const fallbackLines = [
      'Learn the core objective and outcomes for this topic.',
      'Understand key ideas with concrete mini examples.',
      'Follow a guided explanation of the process flow.',
      'Apply the concept in a short practice scenario.',
      'Review summary points and prepare for the next module.',
    ];

    return Array.from({ length: 5 }).map((_, index) => {
      const keyword = previewKeywords[index] || `Topic ${index + 1}`;
      const excerpt = (chunks[index] || fallbackLines[index]).slice(0, 110);

      return {
        page: index + 1,
        title: `${sectionLabels[index]}: ${keyword}`,
        excerpt,
      };
    });
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/88"
    >
      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-bg-card border border-white/10 rounded-[24px] w-full max-w-5xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg md:text-xl">Preview: {material.title || 'Course Content'}</h3>
            <p className="text-sm text-text-secondary leading-relaxed mt-1">
              {isVideo ? 'Preview is limited to first 5 minutes.' : 'Preview is limited to first 1-5 pages.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {hasContentUrl ? (
            isVideo ? (
              material.youtube_url ? (
                <iframe
                  src={getYouTubeEmbedUrl(material.youtube_url)}
                  className="w-full aspect-video rounded-xl border border-white/10"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video preview"
                />
              ) : (
                <video
                  controls
                  controlsList="nodownload noplaybackrate"
                  src={material.file_url || undefined}
                  className="w-full rounded-xl border border-white/10 max-h-[70vh] bg-black"
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (!reachedLimit && el.currentTime >= VIDEO_PREVIEW_SECONDS) {
                      el.currentTime = VIDEO_PREVIEW_SECONDS;
                      el.pause();
                      setReachedLimit(true);
                    }
                  }}
                  onSeeking={(e) => {
                    const el = e.currentTarget;
                    if (el.currentTime > VIDEO_PREVIEW_SECONDS) {
                      el.currentTime = VIDEO_PREVIEW_SECONDS;
                      el.pause();
                      setReachedLimit(true);
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              )
            ) : (
              <div className="w-full min-h-[360px] rounded-xl border border-white/10 bg-bg-elevated p-6 space-y-5">
                <p className="text-xs font-mono text-accent-teal uppercase tracking-wider">Pages 1-5 Preview</p>
                <p className="text-base text-text-primary/95 leading-7">{previewSummary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                  {pagePreviewCards.map((card) => (
                    <div key={card.page} className="h-40 rounded-lg border border-white/10 bg-bg-card p-3.5 flex flex-col gap-2.5 justify-start">
                      <p className="text-xs font-mono text-accent-teal">Page {card.page}</p>
                      <p className="text-sm font-semibold text-text-primary leading-5 line-clamp-2">{card.title}</p>
                      <p className="text-xs text-text-secondary leading-5 line-clamp-4">{card.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="text-sm text-text-secondary bg-bg-elevated border border-white/5 rounded-xl p-4">
              Preview is not available for this item. Enroll to unlock full access.
            </div>
          )}

          {(reachedLimit || !isVideo) && (
            <div className="bg-accent-amber/10 border border-accent-amber/20 rounded-xl p-4 text-base leading-relaxed text-accent-amber">
              Preview limit reached. Enroll now to unlock full content access.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all"
            >
              Close
            </button>
            <button
              onClick={onEnroll}
              className="bg-accent-teal hover:brightness-110 text-bg-base px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              Enroll To Continue
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuizModal({ quiz, onClose, onComplete }: { quiz: Quiz; onClose: () => void; onComplete: () => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const question = questions[currentQuestion];

  if (questions.length === 0 || !question) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/88"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-bg-card border border-white/10 rounded-[24px] w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-display font-bold">Quiz Unavailable</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-text-secondary">This quiz has no valid questions yet. Ask your mentor to update it.</p>
            <button
              onClick={onClose}
              className="w-full bg-accent-teal hover:brightness-110 text-bg-base py-3 rounded-xl text-sm font-bold transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/88"
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
                    : "bg-accent-teal text-bg-base hover:brightness-110"
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
                className="w-full bg-accent-teal hover:brightness-110 text-bg-base py-4 rounded-2xl font-bold font-display transition-all"
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

function MentorQuizEditorModal({
  quiz,
  onClose,
  onSaved,
}: {
  quiz: Quiz;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(quiz.title || '');
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState(
    (quiz.questions || []).map((q: any) => ({
      id: q.id,
      question: q.question || '',
      options: Array.isArray(q.options) ? [...q.options].slice(0, 4) : ['', '', '', ''],
      correct_answer: Number.isFinite(Number(q.correct_answer)) ? Number(q.correct_answer) : 0,
      explanation: q.explanation || '',
      difficulty: q.difficulty === 'easy' || q.difficulty === 'hard' ? q.difficulty : 'medium',
    }))
  );

  const ensureFourOptions = (values: string[]) => {
    const next = [...values];
    while (next.length < 4) next.push('');
    return next.slice(0, 4);
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: undefined,
        question: '',
        options: ['', '', '', ''],
        correct_answer: 0,
        explanation: '',
        difficulty: 'medium',
      },
    ]);
  };

  useEffect(() => {
    setQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        options: ensureFourOptions(Array.isArray(q.options) ? q.options : []),
      }))
    );
    // We only want normalization when modal initializes with potentially malformed data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Quiz title is required.');
      return;
    }

    if (questions.length === 0) {
      toast.error('Add at least one quiz question.');
      return;
    }

    const invalid = questions.some((q) => {
      const opts = ensureFourOptions(q.options).map((o) => String(o).trim());
      return !q.question.trim() || opts.some((o) => !o) || q.correct_answer < 0 || q.correct_answer > 3;
    });

    if (invalid) {
      toast.error('Each question needs text, 4 options, and a valid correct answer.');
      return;
    }

    setSaving(true);
    try {
      const { error: titleError } = await supabase
        .from('quizzes')
        .update({ title: cleanTitle })
        .eq('id', quiz.id);

      if (titleError) throw titleError;

      const existingIds = new Set((quiz.questions || []).map((q: any) => q.id).filter(Boolean));
      const currentIds = new Set(questions.map((q: any) => q.id).filter(Boolean));
      const deletedIds = [...existingIds].filter((id) => !currentIds.has(id));

      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('quiz_questions')
          .delete()
          .in('id', deletedIds as string[]);
        if (deleteError) throw deleteError;
      }

      for (const question of questions) {
        const payload = {
          quiz_id: quiz.id,
          question: question.question.trim(),
          options: ensureFourOptions(question.options).map((o) => o.trim()),
          correct_answer: question.correct_answer,
          explanation: question.explanation?.trim() || null,
          difficulty: question.difficulty,
          ai_generated: true,
        };

        if (question.id) {
          const { error } = await supabase
            .from('quiz_questions')
            .update(payload)
            .eq('id', question.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('quiz_questions')
            .insert(payload);
          if (error) throw error;
        }
      }

      toast.success('Quiz updated successfully.');
      await onSaved();
    } catch (error: any) {
      console.error('Error saving quiz edits:', error);
      toast.error(error.message || 'Failed to save quiz changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/88"
    >
      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-bg-card border border-white/10 rounded-[24px] w-full max-w-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold">Edit Quiz</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-auto">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Quiz Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
            />
          </div>

          {questions.map((question, index) => (
            <div key={`${question.id || 'new'}-${index}`} className="bg-bg-elevated border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold">Question {index + 1}</p>
                <button
                  onClick={() => removeQuestion(index)}
                  className="text-[10px] font-bold text-accent-amber hover:underline"
                >
                  Delete Question
                </button>
              </div>

              <textarea
                value={question.question}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, question: value } : q)));
                }}
                placeholder="Question text"
                className="w-full bg-bg-card border border-white/5 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-accent-teal min-h-[70px]"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ensureFourOptions(question.options).map((option, optIndex) => (
                  <input
                    key={optIndex}
                    value={option}
                    onChange={(e) => {
                      const value = e.target.value;
                      setQuestions((prev) =>
                        prev.map((q, i) => {
                          if (i !== index) return q;
                          const next = ensureFourOptions(q.options);
                          next[optIndex] = value;
                          return { ...q, options: next };
                        })
                      );
                    }}
                    placeholder={`Option ${optIndex + 1}`}
                    className="bg-bg-card border border-white/5 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-accent-teal"
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={question.correct_answer}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, correct_answer: value } : q)));
                  }}
                  className="bg-bg-card border border-white/5 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-accent-teal"
                >
                  {[0, 1, 2, 3].map((optionIndex) => (
                    <option key={optionIndex} value={optionIndex}>Correct Option: {optionIndex + 1}</option>
                  ))}
                </select>
                <select
                  value={question.difficulty}
                  onChange={(e) => {
                    const difficulty = e.target.value === 'easy' || e.target.value === 'hard' ? e.target.value : 'medium';
                    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, difficulty } : q)));
                  }}
                  className="bg-bg-card border border-white/5 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-accent-teal"
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
                <input
                  value={question.explanation || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, explanation: value } : q)));
                  }}
                  placeholder="Explanation (optional)"
                  className="bg-bg-card border border-white/5 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-accent-teal"
                />
              </div>
            </div>
          ))}

          <button
            onClick={addQuestion}
            className="text-xs font-bold text-accent-teal hover:underline"
          >
            + Add Question
          </button>
        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
            className="bg-accent-teal hover:brightness-110 text-bg-base px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

