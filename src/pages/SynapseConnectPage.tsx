import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, MessageSquarePlus, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import { createId, loadOutreach, parseCommaSeparatedList, saveOutreach, SynapseOutreach } from '@/src/lib/synapse';

interface SynapseConnectPageProps {
  profile: Profile | null;
}

export default function SynapseConnectPage({ profile }: SynapseConnectPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [people, setPeople] = useState<Profile[]>([]);
  const [targetId, setTargetId] = useState('');
  const [goal, setGoal] = useState('Build a project team');
  const [projectIdea, setProjectIdea] = useState('');
  const [neededSkills, setNeededSkills] = useState('');
  const [note, setNote] = useState('');
  const [followToo, setFollowToo] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SynapseOutreach[]>([]);

  const preselectedUser = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('user') || '';
  }, [location.search]);

  useEffect(() => {
    setHistory(loadOutreach(profile?.id));
  }, [profile?.id]);

  useEffect(() => {
    if (preselectedUser) {
      setTargetId(preselectedUser);
    }
  }, [preselectedUser]);

  useEffect(() => {
    void loadPeople();
  }, [profile?.id]);

  const loadPeople = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', profile.id)
        .limit(50);

      if (error) throw error;
      setPeople((data || []) as Profile[]);
    } catch (error) {
      console.error('Failed to load people:', error);
      toast.error('Unable to load potential collaborators.');
    }
  };

  const selectedPerson = people.find((person) => person.id === targetId) || null;

  const handleSend = async () => {
    if (!profile?.id) {
      toast.error('Please sign in first.');
      return;
    }

    if (!targetId) {
      toast.error('Choose a person to connect with.');
      return;
    }

    const skills = parseCommaSeparatedList(neededSkills);
    const messageBody = [
      `Hi ${selectedPerson?.full_name || 'there'},`,
      '',
      `I would like to connect through Collab.`,
      `Goal: ${goal.trim() || 'Collaboration'}`,
      projectIdea.trim() ? `Project idea: ${projectIdea.trim()}` : '',
      skills.length > 0 ? `Needed skills: ${skills.join(', ')}` : '',
      note.trim() ? `Note: ${note.trim()}` : '',
      '',
      `From: ${profile.full_name}`,
    ]
      .filter(Boolean)
      .join('\n');

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({ from_id: profile.id, to_id: targetId, content: messageBody });

      if (error) throw error;

      if (followToo) {
        await supabase
          .from('follows')
          .upsert({ follower_id: profile.id, following_id: targetId }, { onConflict: 'follower_id,following_id' });
      }

      const nextHistory = [
        {
          id: createId('outreach'),
          targetId,
          targetName: selectedPerson?.full_name || 'Unknown',
          goal: goal.trim(),
          message: messageBody,
          neededSkills: skills,
          projectIdea: projectIdea.trim(),
          createdAt: new Date().toISOString(),
        },
        ...loadOutreach(profile.id),
      ];

      saveOutreach(profile.id, nextHistory);
      setHistory(nextHistory);
      setProjectIdea('');
      setNeededSkills('');
      setNote('');
      toast.success('Collab request sent.');
    } catch (error: any) {
      console.error('Failed to send Collab request:', error);
      toast.error(error.message || 'Unable to send your Collab request.');
    } finally {
      setSending(false);
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

        <section className="rounded-[32px] border border-white/10 bg-bg-card p-8 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-accent-teal">
            <Link2 className="w-3.5 h-3.5" />
            Collab
          </span>
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-text-primary">
              Start A Real Collaboration
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
              Send a targeted outreach message with your goal, project idea, and needed skills.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-text-primary">Compose Outreach</h2>
              <p className="text-sm text-text-secondary">
                This sends a message directly into the app conversation thread.
              </p>
            </div>

            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal">
              <option value="">Select collaborator</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name} • {person.role}
                </option>
              ))}
            </select>

            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <textarea value={projectIdea} onChange={(e) => setProjectIdea(e.target.value)} placeholder="Describe your project idea" className="min-h-[130px] w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <input value={neededSkills} onChange={(e) => setNeededSkills(e.target.value)} placeholder="Needed skills: React, Python, Research" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note to make your outreach more personal" className="min-h-[100px] w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />

            <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
              <input type="checkbox" checked={followToo} onChange={(e) => setFollowToo(e.target.checked)} className="accent-[#00e0c4]" />
              Follow this person too when the request is sent
            </label>

            <button onClick={handleSend} disabled={sending} className="inline-flex items-center gap-2 rounded-2xl bg-accent-teal px-5 py-3 text-sm font-bold text-bg-base transition-all hover:bg-[#00f5b4] disabled:opacity-60">
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Collab Request'}
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-accent-purple/15 text-accent-purple flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-text-primary">Selected Person</h2>
                  <p className="text-sm text-text-secondary">Context before you send.</p>
                </div>
              </div>
              {selectedPerson ? (
                <div className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                  <p className="font-semibold text-text-primary">{selectedPerson.full_name}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {selectedPerson.role} • {selectedPerson.institution || 'Institution not set'}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    {selectedPerson.bio || 'No bio available yet.'}
                  </p>
                  <button onClick={() => navigate(`/messages?thread=${selectedPerson.id}`)} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-text-primary transition-all hover:bg-bg-card">
                    <MessageSquarePlus className="w-4 h-4" />
                    Open thread
                  </button>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Pick someone from the list to personalize your outreach.</p>
              )}
            </div>

            <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold text-text-primary">Recent Outreach</h2>
              {history.length === 0 ? (
                <p className="text-sm text-text-secondary">No Collab requests sent yet.</p>
              ) : (
                history.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                    <p className="font-semibold text-text-primary">{entry.targetName}</p>
                    <p className="mt-1 text-sm text-text-secondary">{entry.goal || 'Collaboration'}</p>
                    {entry.projectIdea && <p className="mt-2 text-sm text-text-secondary">{entry.projectIdea}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.neededSkills.map((skill) => (
                        <span key={skill} className="rounded-full border border-white/10 bg-bg-card px-3 py-1 text-xs text-text-primary">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => navigate(`/messages?thread=${entry.targetId}`)} className="mt-4 text-sm font-semibold text-accent-teal">
                      Continue conversation
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
