import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Save, UserRound, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import InstitutionCombobox from '@/src/components/InstitutionCombobox';
import CountryPhoneInput from '@/src/components/CountryPhoneInput';
import {
  formatListForInput,
  fetchWorkspace,
  parseCommaSeparatedList,
  persistWorkspace,
} from '@/src/lib/synapse';

interface SynapseCreatePageProps {
  profile: Profile | null;
}

export default function SynapseCreatePage({ profile }: SynapseCreatePageProps) {
  const navigate = useNavigate();
  const [headline, setHeadline] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [availability, setAvailability] = useState('');
  const [projectGoals, setProjectGoals] = useState('');
  const [preferredRolesInput, setPreferredRolesInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setBio(profile?.bio || '');
    setInstitution(profile?.institution || '');
    setPhone(profile?.phone || '');
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return;
    void fetchWorkspace(profile.id).then((loaded) => {
      setHeadline(loaded.headline);
      setSkillsInput(formatListForInput(loaded.skills));
      setInterestsInput(formatListForInput(loaded.interests));
      setAvailability(loaded.availability);
      setProjectGoals(loaded.projectGoals);
      setPreferredRolesInput(formatListForInput(loaded.preferredRoles));
    });
  }, [profile?.id]);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [institution, setInstitution] = useState(profile?.institution || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  const skillChips = useMemo(() => parseCommaSeparatedList(skillsInput), [skillsInput]);
  const interestChips = useMemo(() => parseCommaSeparatedList(interestsInput), [interestsInput]);

  const handleSave = async () => {
    if (!profile?.id) {
      toast.error('Please sign in to update your Collab workspace.');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Add your full name before saving.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          bio: bio.trim() || null,
          institution: institution.trim() || null,
          phone: phone.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await persistWorkspace(profile.id, {
        headline: headline.trim(),
        skills: parseCommaSeparatedList(skillsInput),
        interests: parseCommaSeparatedList(interestsInput),
        availability: availability.trim(),
        projectGoals: projectGoals.trim(),
        preferredRoles: parseCommaSeparatedList(preferredRolesInput),
        updatedAt: new Date().toISOString(),
      });

      toast.success('Collab profile saved.');
    } catch (error: any) {
      console.error('Failed to save Collab workspace:', error);
      toast.error(error.message || 'Unable to save your Collab profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-20 pb-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <button
          onClick={() => safeNavigateBack(navigate, '/collab')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <section className="rounded-[32px] border border-white/10 bg-bg-card p-8 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-accent-teal">
            <UserRound className="w-3.5 h-3.5" />
            Create
          </span>
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-text-primary">
              Build Your Collab Profile
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
              Set up the profile data, collaboration signals, and project preferences that power
              matching across the Collab flow.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-text-primary">Core Identity</h2>
              <p className="text-sm text-text-secondary">Saved into your main profile.</p>
            </div>

            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" className="min-h-[120px] w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <div className="grid gap-4 md:grid-cols-2">
              <InstitutionCombobox value={institution} onChange={setInstitution} placeholder="Type to search institution" className="w-full" />
              <CountryPhoneInput value={phone} onChange={setPhone} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-text-primary">Collaboration Signals</h2>
              <p className="text-sm text-text-secondary">
                Saved locally for the Collab matching flow on this app.
              </p>
            </div>

            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline, e.g. Frontend builder for hackathons" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Skills: React, Python, UI Design" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <input value={interestsInput} onChange={(e) => setInterestsInput(e.target.value)} placeholder="Interests: AI, hackathons, product design" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <input value={preferredRolesInput} onChange={(e) => setPreferredRolesInput(e.target.value)} placeholder="Preferred roles: builder, researcher, presenter" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Availability, e.g. Weeknights and weekends" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <textarea value={projectGoals} onChange={(e) => setProjectGoals(e.target.value)} placeholder="What kinds of projects or teams are you looking for?" className="min-h-[120px] w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />

            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-accent-teal px-5 py-3 text-sm font-bold text-bg-base transition-all hover:bg-[#00f5b4] disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Collab Profile'}
            </button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/8 bg-bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent-teal/10 text-accent-teal flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">Your Skills</h2>
                <p className="text-sm text-text-secondary">These power discovery and matching.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {skillChips.length > 0 ? skillChips.map((skill) => (
                <span key={skill} className="rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-xs text-accent-teal">
                  {skill}
                </span>
              )) : <p className="text-sm text-text-secondary">Add at least a few skills to improve matching.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent-purple/15 text-accent-purple flex items-center justify-center">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">Your Interests</h2>
                <p className="text-sm text-text-secondary">Use these to signal the work you want.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {interestChips.length > 0 ? interestChips.map((interest) => (
                <span key={interest} className="rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-xs text-text-primary">
                  {interest}
                </span>
              )) : <p className="text-sm text-text-secondary">List a few interests so others can discover you.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
