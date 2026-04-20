import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Download, Share2, Calendar, Trophy, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { safeNavigateBack } from '../lib/navigation';

interface Certificate {
  id: string;
  course_title: string;
  mentor_name: string;
  issued_date: string;
  certificate_url?: string;
  verification_code: string;
}

export function CertificatesPage() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id,
          issue_date,
          certificate_url,
          courses (title),
          profiles:mentor_id (full_name)
        `)
        .eq('student_id', user.id)
        .order('issue_date', { ascending: false });

      if (error) throw error;

      const certsData: Certificate[] = data?.map((cert: any) => ({
        id: cert.id,
        course_title: cert.courses?.title || 'Unknown Course',
        mentor_name: cert.profiles?.full_name || 'Unknown Mentor',
        issued_date: cert.issue_date,
        certificate_url: cert.certificate_url,
        verification_code: cert.id
      })) || [];

      setCertificates(certsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      setLoading(false);
    }
  };

  const handleDownload = (cert: Certificate) => {
    if (cert.certificate_url) {
      window.open(cert.certificate_url, '_blank');
    }
  };

  const handleShare = (cert: Certificate) => {
    const shareUrl = cert.certificate_url || `${window.location.origin}/certificates/${cert.id}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Certificate link copied to clipboard!');
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-bg-base">
      <div className="pt-24 pb-10 max-w-6xl mx-auto px-4 md:px-8 text-text-primary">
        {/* Back Button */}
        <button
          onClick={() => safeNavigateBack(navigate, '/courses')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header - Centered */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 text-text-primary">
            Certificates & Badges
          </h1>
          <p className="text-lg text-text-secondary">
            Showcase your achievements and course completions
          </p>
        </div>

        {/* Achievement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Certificates */}
          <div className="border rounded-2xl p-8 transition-colors bg-bg-card/70 border-white/10 hover:border-accent-teal/40">
            <Trophy className="w-12 h-12 mb-4 text-accent-teal" />

            <p className="text-sm font-semibold mb-2 text-accent-teal">
              TOTAL CERTIFICATES EARNED
            </p>
            <sub className="text-text-secondary">Course Achievements</sub>
            <p className="text-5xl font-bold text-accent-teal">
              {certificates.length}
            </p>
          </div>

          <div className="border rounded-2xl p-8 transition-colors bg-bg-card/70 border-white/10 hover:border-accent-teal/40">
            <Award className="w-12 h-12 mb-4 text-accent-teal" />
            <p className="text-sm font-semibold mb-2 text-accent-teal">BADGES ACQUIRED</p>
            <sub className="text-text-secondary">Quiz completed</sub>
            <p className="text-5xl font-bold text-accent-teal">{certificates.length}</p>
          </div>
        </div>

        {/* Certificates Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading your certificates...</p>
            </div>
          </div>
        ) : certificates.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="group relative border rounded-2xl overflow-hidden transition-all duration-300 bg-bg-card/70 border-white/10 hover:border-accent-teal/50 hover:shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
              >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-teal to-accent-amber opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-6 md:p-8">
                  <div className="flex flex-col items-start justify-between gap-6 h-full">
                    {/* Left Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-accent-teal to-accent-amber rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
                          <Trophy className="w-8 h-8 text-bg-base" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold mb-1 text-text-primary">{cert.course_title}</h3>
                          <p className="text-sm text-text-secondary">Issued by {cert.mentor_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2 text-text-secondary">
                          <Calendar className="w-4 h-4 text-accent-teal" />
                          <span className="text-sm">{new Date(cert.issued_date).toLocaleDateString()}</span>
                        </div>
                        <div className="hidden md:block w-px h-6 bg-white/10" />
                        <div className="text-xs px-3 py-1 rounded-full font-semibold bg-accent-teal/10 text-accent-teal border border-accent-teal/20">
                          Verified
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => handleDownload(cert)}
                        className="flex-1 px-6 py-3 bg-accent-teal hover:brightness-110 text-bg-base font-semibold rounded-lg flex items-center justify-center gap-2 transition-all group/btn shadow-[0_10px_24px_rgba(0,0,0,0.14)]"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      <button
                        onClick={() => handleShare(cert)}
                        className="px-4 py-3 md:px-6 font-semibold rounded-lg flex items-center justify-center gap-2 transition-all border border-white/10 bg-bg-elevated text-text-primary hover:border-accent-teal/30 hover:bg-white/5"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden md:inline">Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border rounded-2xl transition-colors bg-bg-card/70 border-white/10">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50 text-text-muted" />
            <h3 className="text-xl font-semibold mb-2 text-text-primary">No Certificates Yet</h3>
            <p className="mb-6 text-text-secondary">Complete courses and pass quizzes to earn certificates</p>
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-2 bg-accent-teal hover:brightness-110 text-bg-base rounded-lg font-semibold transition-colors"
            >
              Browse Courses
            </button>
          </div>
        )}

        {/* Certificate Details Modal (if selected) */}
        {selectedCert && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="border rounded-2xl max-w-2xl w-full p-8 transition-colors bg-bg-card border-white/10">
              <h2 className="text-2xl font-bold mb-4 text-text-primary">{selectedCert.course_title}</h2>
              <p className="mb-6 text-text-secondary">Verification Code: {selectedCert.verification_code}</p>
              <button
                onClick={() => setSelectedCert(null)}
                className="w-full px-6 py-3 border font-semibold rounded-lg transition-colors bg-bg-elevated border-white/10 text-text-primary hover:border-accent-teal/30 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CertificatesPage;

