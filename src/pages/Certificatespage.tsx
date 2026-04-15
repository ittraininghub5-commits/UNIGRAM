import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Download, Share2, Calendar, Trophy, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { safeNavigateBack } from '../lib/navigation';
import { useTheme } from '@/src/context/ThemeContext';

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
  const { theme } = useTheme();
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
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`pt-24 pb-10 max-w-6xl mx-auto px-4 md:px-8 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        {/* Back Button */}
        <button
          onClick={() => safeNavigateBack(navigate, '/courses')}
          className={`mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
            theme === 'dark'
              ? 'border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
              : 'border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header - Centered */}
        <div className="mb-12 text-center">
          <h1 className={`text-4xl md:text-5xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Certificates & Badges
          </h1>
          <p className={`text-lg ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Showcase your achievements and course completions
          </p>
        </div>

        {/* Achievement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Certificates */}
          <div className={`border rounded-2xl p-8 transition-colors ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-green-500/20 to-white/5 border-green-400/30'
              : 'bg-gradient-to-br from-green-100 to-white border-green-200'
          }`}>
            <Trophy className={`w-12 h-12 mb-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
            
            <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
              TOTAL CERTIFICATES EARNED
            </p>
            <sub className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Course Achievements</sub>
            <p className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {certificates.length}
            </p>
          </div>

          <div className={`border rounded-2xl p-8 transition-colors ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border-cyan-500/30'
              : 'bg-gradient-to-br from-cyan-100 to-blue-50 border-cyan-200'
          }`}>
            <Award className={`w-12 h-12 mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} />
            <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>BADGES ACQUIRED</p>
            <sub className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Quiz completed</sub>
            <p className={`text-5xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{certificates.length}</p>
          </div>
        </div>

        {/* Certificates Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Loading your certificates...</p>
            </div>
          </div>
        ) : certificates.length > 0 ? (
          <div className="space-y-6">
            {certificates.map((cert, index) => (
              <div
                key={cert.id}
                className={`group relative border rounded-2xl overflow-hidden transition-all duration-300 ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-white/10 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10'
                    : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-lg'
                }`}
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
                          <h3 className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{cert.course_title}</h3>
                          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Issued by {cert.mentor_name}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4">
                        <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span className="text-sm">{new Date(cert.issued_date).toLocaleDateString()}</span>
                        </div>
                        <div className="hidden md:block w-px h-6 bg-white/10" />
                        <div className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          theme === 'dark'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
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
                        className={`px-4 py-3 md:px-6 font-semibold rounded-lg flex items-center justify-center gap-2 transition-all border ${
                          theme === 'dark'
                            ? 'bg-slate-700/50 border-white/10 text-white hover:bg-slate-700'
                            : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                        }`}
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
          <div className={`text-center py-20 border rounded-2xl transition-colors ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-white/10'
              : 'bg-white border-slate-200'
          }`}>
            <Trophy className={`w-16 h-16 mx-auto mb-4 opacity-50 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Certificates Yet</h3>
            <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Complete courses and pass quizzes to earn certificates</p>
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className={`border rounded-2xl max-w-2xl w-full p-8 transition-colors ${
              theme === 'dark'
                ? 'bg-slate-800 border-white/10'
                : 'bg-white border-slate-200'
            }`}>
              <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedCert.course_title}</h2>
              <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Verification Code: {selectedCert.verification_code}</p>
              <button
                onClick={() => setSelectedCert(null)}
                className={`w-full px-6 py-3 border font-semibold rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700/50 border-white/10 text-white hover:bg-slate-700'
                    : 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                }`}
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