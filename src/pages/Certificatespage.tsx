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
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Padding wrapper */}
      <div className="pt-24 pb-10 max-w-6xl mx-auto px-6 md:px-8">
        <button
          onClick={() => safeNavigateBack(navigate, '/courses')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            Certificates & Badges
          </h1>
          <p className="text-text-secondary">Showcase your achievements and course completions</p>
        </div>

        {/* Achievement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Certificates */}
          <div className="bg-gradient-to-br from-green-500/20 to-white/5 border border-green-400/30 rounded-2xl p-8 backdrop-blur-sm">
            <Trophy className="w-12 h-12 text-green-400 mb-4" />
            
            <p className="text-green-400 text-sm font-semibold mb-2">
              TOTAL CERTIFICATES EARNED
            </p>
            <sub className="text-text-secondary">Course Achievements</sub>
            <p className="text-5xl font-bold text-text-primary">
              {certificates.length}
            </p>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-8 backdrop-blur-sm">
            <Award className="w-12 h-12 text-cyan-400 mb-4" />
            <p className="text-cyan-400 text-sm font-semibold mb-2">BADGES AQUIRED </p>
            <sub className="text-text-secondary">Quiz completed</sub>
            <p className="text-5xl font-bold">{certificates.length}</p>
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
          <div className="space-y-6">
            {certificates.map((cert, index) => (
              <div
                key={cert.id}
                className="group relative bg-bg-card border border-white/10 rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10"
              >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    {/* Left Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-text-primary mb-1">{cert.course_title}</h3>
                          <p className="text-sm text-text-secondary">Issued by {cert.mentor_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2 text-text-secondary">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span className="text-sm">{new Date(cert.issued_date).toLocaleDateString()}</span>
                        </div>
                        <div className="hidden md:block w-px h-6 bg-white/10" />
                        <div className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full font-semibold">
                          ✓ Verified
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex gap-3 w-full md:w-auto">
                      <button
                        onClick={() => handleDownload(cert)}
                        className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all group/btn"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      <button
                        onClick={() => handleShare(cert)}
                        className="px-4 py-3 md:px-6 bg-bg-elevated hover:bg-bg-card border border-white/10 text-text-primary font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
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
          <div className="text-center py-20 bg-bg-card border border-white/10 rounded-2xl">
            <Trophy className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-text-primary mb-2">No Certificates Yet</h3>
            <p className="text-text-secondary mb-6">Complete courses and pass quizzes to earn certificates</p>
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
            >
              Browse Courses
            </button>
          </div>
        )}

        {/* Certificate Details Modal (if selected) */}
        {selectedCert && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-bg-card border border-white/10 rounded-2xl max-w-2xl w-full p-8">
              <h2 className="text-2xl font-bold text-text-primary mb-4">{selectedCert.course_title}</h2>
              <p className="text-text-secondary mb-6">Verification Code: {selectedCert.verification_code}</p>
              <button
                onClick={() => setSelectedCert(null)}
                className="w-full px-6 py-3 bg-bg-elevated hover:bg-bg-card border border-white/10 text-text-primary rounded-lg font-semibold transition-colors"
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