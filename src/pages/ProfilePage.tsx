import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { cn, getInitials } from '@/src/lib/utils';
import { Share2, Edit3, Award, GraduationCap, Quote } from 'lucide-react';
import { toast } from 'sonner';

interface ProfilePageProps {
  currentProfile: Profile | null;
}

export default function ProfilePage({ currentProfile }: ProfilePageProps) {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [id, currentProfile]);

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Cover + Avatar Card */}
      <section className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden">
        <div className="h-40 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#091F14] via-[#140D28] to-[#0A1829]" />
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(0,217,160,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,160,0.2) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          {isOwnProfile && (
            <button className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-black/20 backdrop-blur-md border border-white/10 text-xs font-medium hover:bg-black/40 transition-all">
              Edit Profile
            </button>
          )}
        </div>
        
        <div className="px-8 pb-8">
          <div className="flex items-end justify-between -mt-10 mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-teal to-accent-purple p-1 border-4 border-bg-card">
              <div className="w-full h-full rounded-full bg-bg-card flex items-center justify-center text-3xl font-bold text-accent-teal">
                {getInitials(profile.full_name)}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.success('Link copied!')} className="p-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-all">
                <Share2 className="w-4 h-4 text-text-secondary" />
              </button>
              {isOwnProfile ? (
                <button className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-6 py-2.5 rounded-xl text-sm font-bold font-display transition-all flex items-center gap-2">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              ) : (
                <button className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-8 py-2.5 rounded-xl text-sm font-bold font-display transition-all">
                  Follow
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-extrabold tracking-tight">{profile.full_name}</h1>
              <p className="text-text-secondary text-sm">
                {profile.role === 'student' ? 'Student • Full Stack Learner • Open to opportunities' : `Mentor • ${profile.institution || 'Expert'}`}
              </p>
            </div>

            <div className="flex gap-8">
              <ProfileStat value="12" label="Courses" />
              <ProfileStat value="5" label="Certificates" />
              <ProfileStat value="48" label="Following" />
              <ProfileStat value="3" label="Recommendations" />
            </div>

            <div className="flex flex-wrap gap-2">
              {['System Design', 'React', 'TypeScript', 'Supabase', 'Node.js'].map(tag => (
                <span key={tag} className="px-3 py-1 rounded-lg bg-bg-elevated border border-white/5 text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Certificates */}
      <section className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-accent-teal" /> Certificates
          </h2>
          <span className="px-2 py-0.5 rounded bg-accent-teal/10 text-accent-teal text-[10px] font-bold font-mono uppercase tracking-widest">5 earned</span>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <CertCard title="Full Stack Web Development" mentor="Dr. Priya Nair" date="Mar 2025" icon="🏆" />
          <CertCard title="React Fundamentals" mentor="Anita Sharma" date="Jan 2025" icon="🎓" />
        </div>
      </section>

      {/* Recommendations */}
      <section className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Quote className="w-5 h-5 text-accent-purple" /> Recommendations
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-bg-elevated rounded-2xl p-6 border-l-4 border-accent-teal space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#091F14] text-accent-teal flex items-center justify-center font-bold text-xs">PN</div>
              <div>
                <p className="text-sm font-bold leading-tight">Dr. Priya Nair</p>
                <p className="text-[10px] text-text-secondary">IIT Madras • System Design</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed italic">
              "Abishek is one of the most dedicated students I've mentored. His grasp of distributed systems is exceptional, and he consistently delivers high-quality work."
            </p>
          </div>
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
