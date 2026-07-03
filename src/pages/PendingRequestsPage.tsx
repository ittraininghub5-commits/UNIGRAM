import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/lib/hooks/useAuth';
import { Check, X, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface CertificateRequest {
  id: string;
  enrollment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  course_id: string;
  course_title: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  mentor_notes: string | null;
}

export default function PendingRequestsPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile?.id) return;
    loadRequests();
  }, [profile?.id]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('certificate_requests')
        .select(`
          id,
          enrollment_id,
          student_id,
          course_id,
          status,
          created_at,
          reviewed_at,
          mentor_notes,
          profiles!certificate_requests_student_id_fkey(full_name, email),
          courses(id, title)
        `)
        .eq('mentor_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((req: any) => ({
        id: req.id,
        enrollment_id: req.enrollment_id,
        student_id: req.student_id,
        student_name: req.profiles?.full_name || 'Unknown Student',
        student_email: req.profiles?.email || '',
        course_id: req.course_id,
        course_title: req.courses?.title || 'Unknown Course',
        status: req.status,
        created_at: req.created_at,
        reviewed_at: req.reviewed_at,
        mentor_notes: req.mentor_notes,
      }));

      setRequests(formatted);
    } catch (err) {
      console.error('Error loading certificate requests:', err);
      toast.error('Failed to load certificate requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = useCallback(async (requestId: string) => {
    try {
      setApproving(requestId);
      const response = await fetch(`/api/certificate-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorNotes: notes[requestId] || null }),
      });

      if (!response.ok) throw new Error('Failed to approve');
      
      toast.success('Certificate approved and generated');
      await loadRequests();
    } catch (err) {
      console.error('Error approving certificate:', err);
      toast.error('Failed to approve certificate');
    } finally {
      setApproving(null);
    }
  }, [notes]);

  const handleReject = useCallback(async (requestId: string) => {
    try {
      setRejecting(requestId);
      const response = await fetch(`/api/certificate-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorNotes: notes[requestId] || null }),
      });

      if (!response.ok) throw new Error('Failed to reject');
      
      toast.success('Certificate request rejected');
      await loadRequests();
    } catch (err) {
      console.error('Error rejecting certificate:', err);
      toast.error('Failed to reject certificate');
    } finally {
      setRejecting(null);
    }
  }, [notes]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30';
      case 'approved':
        return 'bg-green-500/10 text-green-300 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/10 text-red-300 border-red-500/30';
      default:
        return 'bg-text-muted/10 text-text-muted border-text-muted/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-accent-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const reviewedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Certificate Requests</h1>
          <p className="text-text-muted">Review and approve or reject student certificate requests</p>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Pending ({pendingRequests.length})
            </h2>
            <div className="grid gap-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="editorial-card rounded-2xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-text-muted mb-1">Course</p>
                      <p className="font-semibold text-text-primary">{req.course_title}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-muted mb-1">Student</p>
                      <p className="font-semibold text-text-primary">{req.student_name}</p>
                      <p className="text-xs text-text-muted">{req.student_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-muted mb-1">Requested</p>
                      <p className="font-semibold text-text-primary">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(req.status)}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-text-muted mb-2">Mentor Notes</label>
                    <textarea
                      value={notes[req.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="Add optional notes for the student..."
                      className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-white/10 text-text-primary placeholder:text-text-muted focus:border-accent-teal/50 outline-none transition-all text-sm"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={rejecting === req.id || approving === req.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={approving === req.id || rejecting === req.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-300 hover:bg-green-500/20 disabled:opacity-50 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviewed Requests */}
        {reviewedRequests.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Reviewed ({reviewedRequests.length})
            </h2>
            <div className="grid gap-4">
              {reviewedRequests.map((req) => (
                <div key={req.id} className="editorial-card rounded-2xl p-6 opacity-75">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-text-muted mb-1">Course</p>
                      <p className="font-semibold text-text-primary">{req.course_title}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-muted mb-1">Student</p>
                      <p className="font-semibold text-text-primary">{req.student_name}</p>
                      <p className="text-xs text-text-muted">{req.student_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-muted mb-1">Reviewed</p>
                      <p className="font-semibold text-text-primary">
                        {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(req.status)}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                      {req.mentor_notes && (
                        <div className="flex items-center gap-2 text-text-muted text-xs cursor-help" title={req.mentor_notes}>
                          <MessageSquare className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {requests.length === 0 && (
          <div className="editorial-card rounded-2xl p-8 text-center">
            <p className="text-text-muted mb-2">No certificate requests yet</p>
            <p className="text-sm text-text-muted">Students will send certificate requests after completing your courses</p>
          </div>
        )}
      </div>
    </div>
  );
}
