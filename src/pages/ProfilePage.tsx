import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { cn, getInitials } from '@/src/lib/utils';
import { isMentorRole, isStudentRole } from '@/src/lib/roles';
import InstitutionCombobox from '@/src/components/InstitutionCombobox';
import { Share2, Edit3, Award, GraduationCap, Quote } from 'lucide-react';
import { toast } from 'sonner';

interface ProfilePageProps {
  currentProfile: Profile | null;
}

export default function ProfilePage({ currentProfile }: ProfilePageProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftInstitution, setDraftInstitution] = useState('');
  const [draftAvatarUrl, setDraftAvatarUrl] = useState('');
  const [stats, setStats] = useState({ courses: 0, certs: 0, following: 0, recommendations: 0 });
  const [certificates, setCertificates] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [id, currentProfile]);

  useEffect(() => {
    const targetId = id || currentProfile?.id;
    if (!targetId || !profile) {
      return;
    }

    const channel = supabase
      .channel(`profile-live-${targetId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${targetId}` }, () => {
        fetchProfile();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, () => {
        fetchProfile();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => {
        fetchProfileStats(profile);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => {
        fetchProfileStats(profile);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'certificates' }, () => {
        fetchProfileStats(profile);
        fetchProfileCertificates(profile);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations' }, () => {
        fetchProfileRecommendations(profile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, currentProfile?.id, profile?.id]);

  const fetchProfileStats = async (targetProfile: Profile) => {
    try {
      const isMentor = isMentorRole(targetProfile.role);

      const [coursesResult, certsResult, recResult] = await Promise.all([
        isMentor
          ? supabase.from('courses').select('id', { count: 'exact', head: true }).eq('mentor_id', targetProfile.id)
          : supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('student_id', targetProfile.id),
        isMentor
          ? supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('mentor_id', targetProfile.id)
          : supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('student_id', targetProfile.id),
        isMentor
          ? supabase.from('recommendations').select('id', { count: 'exact', head: true }).eq('mentor_id', targetProfile.id)
          : supabase.from('recommendations').select('id', { count: 'exact', head: true }).eq('student_id', targetProfile.id),
      ]);

      setStats({
        courses: coursesResult.count || 0,
        certs: certsResult.count || 0,
        following: targetProfile.following_count || 0,
        recommendations: recResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching profile stats:', error);
    }
  };

  const fetchProfileCertificates = async (targetProfile: Profile) => {
    try {
      const isMentor = isMentorRole(targetProfile.role);
      const { data, error } = await supabase
        .from('certificates')
        .select('id, issue_date, course:courses(title), mentor:profiles(full_name), student:profiles(full_name)')
        .eq(isMentor ? 'mentor_id' : 'student_id', targetProfile.id)
        .order('issue_date', { ascending: false })
        .limit(6);

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      setCertificates([]);
    }
  };

  const fetchProfileRecommendations = async (targetProfile: Profile) => {
    try {
      const isMentor = isMentorRole(targetProfile.role);
      const { data, error } = await supabase
        .from('recommendations')
        .select('id, content, created_at, mentor:profiles(full_name, institution), student:profiles(full_name, institution)')
        .eq(isMentor ? 'mentor_id' : 'student_id', targetProfile.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setRecommendations(data || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecommendations([]);
    }
  };

  useEffect(() => {
    const fetchFollowState = async () => {
      if (!currentProfile?.id || !profile?.id || currentProfile.id === profile.id) {
        setIsFollowing(false);
        return;
      }

      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentProfile.id)
        .eq('following_id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking follow state:', error);
        return;
      }

      setIsFollowing(!!data);
    };

    fetchFollowState();
  }, [currentProfile?.id, profile?.id]);

  const fetchProfile = async () => {
    const targetId = id || currentProfile?.id;
    if (!targetId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single();
      
      if (error) throw error;
      setProfile(data as Profile);
      setDraftName(data.full_name || '');
      setDraftInstitution(data.institution || '');
      setDraftAvatarUrl(data.avatar_url || '');
      await Promise.all([
        fetchProfileStats(data as Profile),
        fetchProfileCertificates(data as Profile),
        fetchProfileRecommendations(data as Profile),
      ]);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (!id || id === currentProfile?.id) setProfile(currentProfile);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Loading profile...</div>;
  if (!profile) return <div className="p-20 text-center">Profile not found</div>;

  const isOwnProfile = profile.id === currentProfile?.id;

  const handleToggleFollow = async () => {
    if (!currentProfile?.id || isOwnProfile) return;

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentProfile.id)
          .eq('following_id', profile.id);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentProfile.id, following_id: profile.id });

        if (error) throw error;
        setIsFollowing(true);

        if (isStudentRole(currentProfile.role) && isMentorRole(profile.role)) {
          const introMessage = `Hi ${profile.full_name}, I started following your content and would like to learn from you.`;
          await supabase.from('messages').insert({
            from_id: currentProfile.id,
            to_id: profile.id,
            content: introMessage,
          });
          navigate(`/messages?thread=${profile.id}`);
          toast.success('Followed mentor. You can message directly now.');
          return;
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Unable to update follow status.');
    }
  };

  const handleSaveProfile = async () => {
    if (!isOwnProfile || !profile?.id) return;

    setSavingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: draftName.trim() || profile.full_name,
          institution: draftInstitution.trim() || null,
          avatar_url: draftAvatarUrl.trim() || null,
        })
        .eq('id', profile.id)
        .select('*')
        .single();

      if (error) throw error;
      setProfile(data as Profile);
      setEditingProfile(false);
      toast.success('Profile updated successfully.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="pt-24 pb-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative">
      <div className="pointer-events-none absolute -top-10 right-6 w-56 h-56 rounded-full bg-[radial-gradient(circle,rgba(73,220,122,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute top-96 -left-12 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(34,242,239,0.12),transparent_70%)]" />
      {/* Cover + Avatar Card */}
      <section className="bg-bg-card/70 border border-white/10 rounded-2xl overflow-hidden">
        <div className="h-40 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a1c18] via-[#0f1f2a] to-[#0c1730]" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(73,220,122,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(34,242,239,0.2) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(201,35,248,0.2),transparent_70%)]" />
          {isOwnProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-black/35 border border-white/10 text-xs font-medium hover:bg-black/50 transition-all"
            >
              Edit Profile
            </button>
          )}
        </div>
        
        <div className="px-5 sm:px-8 pt-5 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-teal via-accent-amber to-accent-purple p-1 border-4 border-bg-card shadow-lg shadow-black/30">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full rounded-full object-cover bg-bg-card"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="w-full h-full rounded-full bg-bg-card items-center justify-center text-3xl font-bold text-accent-teal"
                style={{ display: profile.avatar_url ? 'none' : 'flex' }}
              >
                {getInitials(profile.full_name)}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 ml-auto">
              <button
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/profile/${profile.id}`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success('Profile link copied!');
                  } catch {
                    toast.error('Unable to copy profile link.');
                  }
                }}
                className="p-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-all shrink-0"
              >
                <Share2 className="w-4 h-4 text-text-secondary" />
              </button>
              {isOwnProfile ? (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="bg-accent-teal hover:brightness-110 text-bg-base px-5 sm:px-6 py-2.5 rounded-full text-sm font-bold font-display transition-all flex items-center gap-2 shrink-0"
                >
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleToggleFollow}
                    className="bg-accent-teal hover:brightness-110 text-bg-base px-8 py-2.5 rounded-full text-sm font-bold font-display transition-all"
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  {isFollowing && (
                    <button
                      onClick={() => navigate(`/messages?thread=${profile.id}`)}
                      className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all"
                    >
                      Message
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight [overflow-wrap:anywhere] break-words">{profile.full_name}</h1>
              <p className="text-text-secondary text-sm">
                {isStudentRole(profile.role) ? 'Student • Full Stack Learner • Open to opportunities' : `Mentor • ${profile.institution || 'Expert'}`}
              </p>
            </div>

            <div className="flex flex-wrap gap-5 sm:gap-8">
              <ProfileStat value={String(stats.courses)} label="Courses" />
              <ProfileStat value={String(stats.certs)} label="Certificates" />
              <ProfileStat value={String(stats.following)} label="Following" />
              <ProfileStat value={String(stats.recommendations)} label="Recommendations" />
            </div>

            <div className="flex flex-wrap gap-2">
              {['System Design', 'React', 'TypeScript', 'Supabase', 'Node.js'].map(tag => (
                <span key={tag} className="px-3 py-1 rounded-lg bg-bg-elevated border border-white/5 text-[10px] font-bold text-text-secondary uppercase tracking-widest shadow-[0_8px_18px_rgba(4,10,10,0.3)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {editingProfile && isOwnProfile && (
        <section className="bg-bg-card/70 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Edit Profile</h2>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Full name"
            className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
          />
          <InstitutionCombobox
            value={draftInstitution}
            onChange={setDraftInstitution}
            placeholder="Type to search institution"
          />
          <input
            value={draftAvatarUrl}
            onChange={(e) => setDraftAvatarUrl(e.target.value)}
            placeholder="Profile image URL"
            className="w-full bg-bg-elevated border border-white/5 rounded-xl py-3 px-4 text-sm outline-none focus:border-accent-teal"
          />
          <div className="flex items-center gap-3 bg-bg-elevated border border-white/5 rounded-xl p-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-bg-card border border-white/10 flex items-center justify-center text-xs font-bold text-accent-teal">
              {draftAvatarUrl.trim() ? (
                <img
                  src={draftAvatarUrl.trim()}
                  alt="Avatar preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span>{getInitials(draftName || profile.full_name)}</span>
            </div>
            <p className="text-xs text-text-secondary">Paste a public image link to update your profile photo.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditingProfile(false)}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Certificates */}
      <section className="bg-bg-card/70 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-accent-teal" /> Certificates
          </h2>
          <span className="px-2 py-0.5 rounded bg-accent-teal/10 text-accent-teal text-[10px] font-bold font-mono uppercase tracking-widest">5 earned</span>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          {certificates.length === 0 ? (
            <p className="text-sm text-text-secondary">No certificates found yet.</p>
          ) : (
            certificates.map((cert: any) => (
              <CertCard
                key={cert.id}
                title={cert.course?.title || 'Course'}
                mentor={cert.mentor?.full_name || cert.student?.full_name || 'Unigram'}
                date={new Date(cert.issue_date).toLocaleDateString()}
                icon="🏆"
              />
            ))
          )}
        </div>
      </section>

      {/* Recommendations */}
      <section className="bg-bg-card/70 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Quote className="w-5 h-5 text-accent-purple" /> Recommendations
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {recommendations.length === 0 ? (
            <p className="text-sm text-text-secondary">No recommendations yet.</p>
          ) : (
            recommendations.map((recommendation: any) => {
              const author = isMentorRole(profile.role) ? recommendation.student : recommendation.mentor;
              return (
                <div key={recommendation.id} className="bg-bg-elevated rounded-2xl p-6 border-l-4 border-accent-teal space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-bg-card text-accent-teal flex items-center justify-center font-bold text-xs border border-white/10">
                      {getInitials(author?.full_name || 'U')}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">{author?.full_name || 'Unigram User'}</p>
                      <p className="text-[10px] text-text-secondary">{author?.institution || 'Unigram'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed italic">
                    "{recommendation.content}"
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xl font-display font-extrabold tracking-tight">{value}</div>
      <div className="text-[9px] font-mono text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}

function CertCard({ title, mentor, date, icon }: { title: string; mentor: string; date: string; icon: string }) {
  return (
    <div className="bg-bg-elevated border border-white/5 rounded-2xl p-5 hover:border-accent-teal/30 transition-all cursor-pointer group">
      <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <div className="space-y-1">
        <p className="text-sm font-bold leading-tight group-hover:text-accent-teal transition-colors">{title}</p>
        <p className="text-[10px] text-text-secondary">{mentor} • {date}</p>
      </div>
    </div>
  );
}
