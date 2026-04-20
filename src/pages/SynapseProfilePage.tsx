import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Clock3, Lightbulb, MessageSquare, UserRound, Wrench } from 'lucide-react';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import { getInitials } from '@/src/lib/utils';
import { loadWorkspace } from '@/src/lib/synapse';

interface SynapseProfilePageProps {
  currentProfile: Profile | null;
}

export default function SynapseProfilePage({ currentProfile }: SynapseProfilePageProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const targetId = id || currentProfile?.id;
      if (!targetId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
        if (error) throw error;
        setProfile((data || null) as Profile | null);
      } catch (error) {
        console.error('Failed to load Collab profile:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [id, currentProfile?.id]);

  const workspace = useMemo(() => loadWorkspace(profile?.id), [profile?.id]);

  if (loading) {
    return <div className="pt-24 p-10 text-center text-text-secondary">Loading Collab profile...</div>;
  }

  if (!profile) {
    return <div className="pt-24 p-10 text-center text-text-secondary">Collab profile not found.</div>;
  }

  return (
    <div className="pt-20 pb-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <button
          onClick={() => safeNavigateBack(navigate, '/collab/discover')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <section className="rounded-[32px] border border-white/10 bg-bg-card p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-5">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-accent-teal to-accent-purple p-[2px]">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-bg-card text-xl font-bold text-accent-teal">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    getInitials(profile.full_name)
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-accent-teal">Collab Profile</p>
                  <h1 className="font-display text-4xl font-black tracking-tight text-text-primary">
                    {profile.full_name}
                  </h1>
                  <p className="mt-2 text-sm text-text-secondary">
                    {workspace.headline || profile.bio || 'No Collab headline added yet.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-text-secondary">
                    {profile.role}
                  </span>
                  {profile.institution && (
                    <span className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-text-secondary">
                      {profile.institution}
                    </span>
                  )}
                  {workspace.availability && (
                    <span className="rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-accent-teal">
                      {workspace.availability}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/messages?thread=${profile.id}`)}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent-teal px-5 py-3 text-sm font-bold text-bg-base transition-all hover:bg-[#00f5b4]"
            >
              <MessageSquare className="w-4 h-4" />
              Open Messages
            </button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <InfoCard
            icon={<Wrench className="w-5 h-5" />}
            title="Skills"
            items={workspace.skills}
            empty="No skills added in Collab Create yet."
          />
          <InfoCard
            icon={<Lightbulb className="w-5 h-5" />}
            title="Interests"
            items={workspace.interests}
            empty="No interests added in Collab Create yet."
          />
          <InfoCard
            icon={<Briefcase className="w-5 h-5" />}
            title="Preferred Roles"
            items={workspace.preferredRoles}
            empty="No preferred roles added yet."
          />
          <InfoCard
            icon={<Clock3 className="w-5 h-5" />}
            title="Project Goals"
            items={workspace.projectGoals ? [workspace.projectGoals] : []}
            empty="No project goals saved yet."
          />
        </section>

        <section className="rounded-3xl border border-white/8 bg-bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-accent-purple/15 text-accent-purple flex items-center justify-center">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-text-primary">About This View</h2>
              <p className="text-sm text-text-secondary">This page shows Collab Create data plus basic profile information.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-accent-teal/10 text-accent-teal flex items-center justify-center">
          {icon}
        </div>
        <h2 className="font-display text-xl font-bold text-text-primary">{title}</h2>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-xs text-text-primary">
              {item}
            </span>
          ))
        ) : (
          <p className="text-sm text-text-secondary">{empty}</p>
        )}
      </div>
    </div>
  );
}
