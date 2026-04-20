import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquare, Search, SlidersHorizontal, UserPlus, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import { cn, getInitials } from '@/src/lib/utils';
import { computeMatchScore, loadWorkspace } from '@/src/lib/synapse';

interface SynapseDiscoverPageProps {
  profile: Profile | null;
}

export default function SynapseDiscoverPage({ profile }: SynapseDiscoverPageProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'mentor' | 'sameInstitution'>('all');
  const [sortBy, setSortBy] = useState<'match' | 'followers' | 'name'>('match');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const myWorkspace = useMemo(() => loadWorkspace(profile?.id), [profile?.id]);

  useEffect(() => {
    void loadDiscoverData();
  }, [profile?.id]);

  const loadDiscoverData = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [{ data: profileRows, error: profilesError }, { data: followRows, error: followsError }] =
        await Promise.all([
          supabase.from('profiles').select('*').neq('id', profile.id).limit(60),
          supabase.from('follows').select('following_id').eq('follower_id', profile.id),
        ]);

      if (profilesError) throw profilesError;
      if (followsError) throw followsError;

      setProfiles((profileRows || []) as Profile[]);
      setFollowedIds(new Set((followRows || []).map((row: any) => row.following_id)));
    } catch (error) {
      console.error('Failed to load discover page:', error);
      toast.error('Unable to load Collab discovery.');
    } finally {
      setLoading(false);
    }
  };

  const rankedProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return profiles
      .map((candidate) => {
        const candidateWorkspace = loadWorkspace(candidate.id);
        const sameInstitution =
          !!profile?.institution &&
          !!candidate.institution &&
          profile.institution.toLowerCase() === candidate.institution.toLowerCase();

        const score = computeMatchScore(myWorkspace, candidateWorkspace, sameInstitution);
        const haystack = [
          candidate.full_name,
          candidate.bio || '',
          candidate.institution || '',
          candidate.role,
          candidateWorkspace.headline,
          candidateWorkspace.skills.join(' '),
          candidateWorkspace.interests.join(' '),
        ]
          .join(' ')
          .toLowerCase();

        return {
          candidate,
          candidateWorkspace,
          score,
          sameInstitution,
          matchesQuery: !normalizedQuery || haystack.includes(normalizedQuery),
        };
      })
      .filter((row) => row.matchesQuery)
      .filter((row) => {
        if (roleFilter === 'all') return true;
        if (roleFilter === 'sameInstitution') return row.sameInstitution;
        return row.candidate.role === roleFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'followers') {
          return b.candidate.followers_count - a.candidate.followers_count;
        }
        if (sortBy === 'name') {
          return a.candidate.full_name.localeCompare(b.candidate.full_name);
        }
        return b.score - a.score || b.candidate.followers_count - a.candidate.followers_count;
      });
  }, [profiles, query, roleFilter, sortBy, myWorkspace, profile?.institution]);

  const handleToggleFollow = async (targetId: string) => {
    if (!profile?.id) {
      toast.error('Sign in to connect with people.');
      return;
    }

    const isFollowing = followedIds.has(targetId);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', profile.id)
          .eq('following_id', targetId);

        if (error) throw error;

        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: profile.id, following_id: targetId });

        if (error) throw error;
        setFollowedIds((prev) => new Set(prev).add(targetId));
      }
    } catch (error: any) {
      console.error('Follow toggle failed:', error);
      toast.error(error.message || 'Unable to update connection.');
    }
  };

  return (
    <div className="pt-20 pb-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <button
          onClick={() => safeNavigateBack(navigate, '/collab')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <section className="rounded-[32px] border border-white/10 bg-bg-card p-8 space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-accent-teal">
            <Search className="w-3.5 h-3.5" />
            Discover
          </span>
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-text-primary">
              Match With People By Skill
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
              Browse peers, compare overlap, filter by role or institution, and jump to their profile or messages.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, skill, interest, institution..." className="w-full rounded-2xl border border-white/8 bg-bg-elevated py-3 pl-11 pr-4 text-sm outline-none focus:border-accent-teal" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <SlidersHorizontal className="w-4 h-4 text-accent-teal" />
                  Role
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'student', 'mentor', 'sameInstitution'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setRoleFilter(option)}
                      className={cn(
                        'rounded-2xl border px-4 py-2 text-sm font-semibold transition-all',
                        roleFilter === option
                          ? 'border-accent-teal/30 bg-accent-teal/10 text-accent-teal'
                          : 'border-white/8 bg-bg-card text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {option === 'sameInstitution'
                        ? 'Same institution'
                        : option[0].toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                <div className="mb-3 text-sm font-semibold text-text-primary">Sort by</div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full rounded-2xl border border-white/8 bg-bg-card px-4 py-3 text-sm outline-none focus:border-accent-teal"
                >
                  <option value="match">Best match</option>
                  <option value="followers">Most followed</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-white/8 bg-bg-card p-8 text-sm text-text-secondary">
              Loading collaborators...
            </div>
          ) : rankedProfiles.length === 0 ? (
            <div className="rounded-3xl border border-white/8 bg-bg-card p-8 text-sm text-text-secondary">
              No matching collaborators yet. Try broadening your search or add more skills in Create.
            </div>
          ) : (
            rankedProfiles.map(({ candidate, candidateWorkspace, score, sameInstitution }) => {
              const isFollowing = followedIds.has(candidate.id);

              return (
                <article key={candidate.id} className="rounded-3xl border border-white/8 bg-bg-card p-6 transition-all hover:border-accent-teal/20">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent-teal to-accent-purple p-[2px]">
                        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-bg-card text-sm font-bold text-accent-teal">
                          {candidate.avatar_url ? (
                            <img src={candidate.avatar_url} alt={candidate.full_name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            getInitials(candidate.full_name)
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-display text-xl font-bold text-text-primary">
                              {candidate.full_name}
                            </h2>
                            {candidate.is_verified && <CheckCircle2 className="w-4 h-4 text-accent-teal" />}
                            <span className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-text-secondary">
                              {candidate.role}
                            </span>
                            <span className="rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-accent-teal">
                              Match {score}
                            </span>
                            {sameInstitution && (
                              <span className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-text-secondary">
                                Same institution
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-text-secondary">
                            {candidateWorkspace.headline || candidate.bio || 'No headline yet.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(candidateWorkspace.skills.length > 0
                            ? candidateWorkspace.skills
                            : [candidate.institution || 'Open to collaboration']
                          ).slice(0, 6).map((item) => (
                            <span key={item} className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-xs text-text-primary">
                              {item}
                            </span>
                          ))}
                        </div>

                        <div className="text-sm text-text-secondary">
                          <span className="text-text-primary">{candidate.followers_count}</span> followers
                          {' • '}
                          {candidateWorkspace.availability || 'Availability not shared yet'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleToggleFollow(candidate.id)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                          isFollowing
                            ? 'border border-white/10 bg-bg-elevated text-text-primary'
                            : 'bg-accent-teal text-bg-base hover:bg-[#00f5b4]',
                        )}
                      >
                        <UserPlus className="w-4 h-4" />
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                      <button onClick={() => navigate(`/messages?thread=${candidate.id}`)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-text-primary transition-all hover:bg-bg-elevated">
                        <MessageSquare className="w-4 h-4" />
                        Message
                      </button>
                      <button onClick={() => navigate(`/collab/profile/${candidate.id}`)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-text-primary transition-all hover:bg-bg-elevated">
                        <UserRound className="w-4 h-4" />
                        View Profile
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
