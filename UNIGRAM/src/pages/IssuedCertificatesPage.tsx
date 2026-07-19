import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/lib/hooks/useAuth';
import { Download, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

interface IssuedCertificate {
  id: string;
  enrollment_id: string;
  student_id: string;
  student_name: string;
  course_id: string;
  course_title: string;
  certificate_url: string;
  issue_date: string;
  student_email: string;
}

export default function IssuedCertificatesPage() {
  const { profile } = useAuth();
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    loadIssuedCertificates();
  }, [profile?.id]);

  const loadIssuedCertificates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id,
          enrollment_id,
          student_id,
          course_id,
          certificate_url,
          issue_date,
          mentor_id,
          profiles!certificates_student_id_fkey(full_name, email),
          courses(id, title)
        `)
        .eq('mentor_id', profile?.id)
        .order('issue_date', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((cert: any) => ({
        id: cert.id,
        enrollment_id: cert.enrollment_id,
        student_id: cert.student_id,
        student_name: cert.profiles?.full_name || 'Unknown Student',
        course_id: cert.course_id,
        course_title: cert.courses?.title || 'Unknown Course',
        certificate_url: cert.certificate_url,
        issue_date: cert.issue_date,
        student_email: cert.profiles?.email || '',
      }));

      setCertificates(formatted);
    } catch (err) {
      console.error('Error loading issued certificates:', err);
      toast.error('Failed to load issued certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-accent-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Issued Certificates</h1>
          <p className="text-text-muted">Manage and download certificates you've issued</p>
        </div>

        {certificates.length === 0 ? (
          <div className="editorial-card rounded-2xl p-8 text-center">
            <p className="text-text-muted mb-2">No certificates issued yet</p>
            <p className="text-sm text-text-muted">Certificates will appear here once your students complete courses</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {certificates.map((cert) => (
              <div key={cert.id} className="editorial-card rounded-2xl p-6 hover:border-accent-teal/50 transition-all">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-text-muted mb-1">Course</p>
                    <p className="font-semibold text-text-primary">{cert.course_title}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-text-muted" />
                      <p className="text-sm text-text-muted">Student</p>
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{cert.student_name}</p>
                      <p className="text-xs text-text-muted">{cert.student_email}</p>
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-text-muted" />
                        <p className="text-sm text-text-muted">Issued</p>
                      </div>
                      <p className="font-semibold text-text-primary">
                        {new Date(cert.issue_date).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(cert.certificate_url, `certificate-${cert.enrollment_id}.pdf`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
