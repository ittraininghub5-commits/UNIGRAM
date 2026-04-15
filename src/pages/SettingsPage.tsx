import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, User, Phone, AlignLeft, LogOut, ArrowLeft } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import { Profile } from '@/src/types';
import InstitutionCombobox from '@/src/components/InstitutionCombobox';
import { toast } from 'sonner';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [institution, setInstitution] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) {
          navigate('/auth');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        const p = (data || null) as Profile | null;
        setProfile(p);
        setFullName(p?.full_name || '');
        setBio(p?.bio || '');
        setInstitution(p?.institution || '');
        setPhone(p?.phone || '');
        setAvatarUrl(p?.avatar_url || '');
      } catch (error) {
        console.error('Settings load error:', error);
        toast.error('Unable to load settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate]);

  const handleSave = async () => {
    if (!profile?.id) return;
    if (!fullName.trim()) {
      toast.error('Full name is required.');
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
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Settings saved successfully.');
    } catch (error) {
      console.error('Settings save error:', error);
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="h-40 rounded-3xl bg-bg-card border border-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 space-y-6">
      <button
        onClick={() => safeNavigateBack(navigate, '/feed')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="space-y-1">
        <h1 className="text-3xl font-display font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-text-secondary">Manage your profile preferences for student and mentor workflows.</p>
      </div>

      <section className="bg-bg-card/70 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Full Name</span>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent-teal"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Institution</span>
            <InstitutionCombobox
              value={institution}
              onChange={setInstitution}
              placeholder="Type to search institution"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Phone</span>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent-teal"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Role</span>
            <div className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2.5 px-3 text-sm text-text-secondary">
              {profile?.role || 'student'}
            </div>
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Profile Photo URL</span>
          <div className="flex items-center gap-3 bg-bg-elevated border border-white/5 rounded-xl p-3">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-bg-card border border-white/10 flex items-center justify-center text-xs font-bold text-accent-teal">
              {avatarUrl.trim() ? (
                <img
                  src={avatarUrl.trim()}
                  alt="Avatar preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <span>{(fullName || 'User').split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}</span>
            </div>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-1.5 block">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Bio</span>
          <div className="relative">
            <AlignLeft className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent-teal"
            />
          </div>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
            className="bg-accent-teal hover:brightness-110 text-bg-base px-5 py-2.5 rounded-full text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={handleSignOut}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
