import React, { useState, useEffect } from 'react';
import { Award, Download, Share2, Calendar, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Certificate {
  id: string;
  course_title: string;
  mentor_name: string;
  issued_date: string;
  certificate_url?: string;
  verification_code: string;
}

export function CertificatesPage() {
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
          verification_code,
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
        verification_code: cert.verification_code
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
    const verifyUrl = `${window.location.origin}/verify/${cert.verification_code}`;
    navigator.clipboard.writeText(verifyUrl);
    alert('Certificate link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 md:p-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">
          Certificates & Badges
        </h1>
        <p className="text-slate-400">Showcase your achievements and course completions</p>
      </div>

      {/* Achievement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
  {/* Certificates */}
  <div className="bg-gradient-to-br from-green-500/20 to-white/5 border border-green-400/30 rounded-2xl p-8 backdrop-blur-sm">
    <Trophy className="w-12 h-12 text-green-400 mb-4" />
    
    <p className="text-green-400 text-sm font-semibold mb-2">
      TOTAL CERTIFICATES (Course Achievements)
    </p>
    
    <p className="text-5xl font-bold text-white">
      {certificates.length}
    </p>
  </div>

        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-8 backdrop-blur-sm">
          <Award className="w-12 h-12 text-cyan-400 mb-4" />
          <p className="text-cyan-400 text-sm font-semibold mb-2">COURSES COMPLETED</p>
          <p className="text-5xl font-bold">{certificates.length}</p>
        </div>
      </div>

      {/* Certificates Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading your certificates...</p>
          </div>
        </div>
      ) : certificates.length > 0 ? (
        <div className="space-y-6">
          {certificates.map((cert, index) => (
            <div
              key={cert.id}
              className="group relative bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10"
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
                        <h3 className="text-2xl font-bold text-white mb-1">{cert.course_title}</h3>
                        <p className="text-sm text-slate-400">Issued by {cert.mentor_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span className="text-sm">{new Date(cert.issued_date).toLocaleDateString()}</span>
                      </div>
                      <div className="hidden md:block w-px h-6 bg-slate-700" />
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
                      className="px-4 py-3 md:px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
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
        <div className="text-center py-20 bg-gradient-to-br from-slate-800/30 to-slate-900/30 border border-slate-700/50 rounded-2xl">
          <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No Certificates Yet</h3>
          <p className="text-slate-400 mb-6">Complete courses and pass quizzes to earn certificates</p>
          <button className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors">
            Browse Courses
          </button>
        </div>
      )}

      {/* Certificate Details Modal (if selected) */}
      {selectedCert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-8">
            <h2 className="text-2xl font-bold text-white mb-4">{selectedCert.course_title}</h2>
            <p className="text-slate-400 mb-6">Verification Code: {selectedCert.verification_code}</p>
            <button
              onClick={() => setSelectedCert(null)}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CertificatesPage;