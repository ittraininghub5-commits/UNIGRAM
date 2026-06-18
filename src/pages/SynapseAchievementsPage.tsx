import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Medal, PlusCircle, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Certificate, Profile, Recommendation } from '@/src/types';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
import { createId, fetchAchievementsList, saveAchievements, SynapseAchievement } from '@/src/lib/synapse';

interface SynapseAchievementsPageProps {
  profile: Profile | null;
}

interface GameScoreRow {
  id: string;
  game_type: string;
  score: number;
  created_at: string;
}

export default function SynapseAchievementsPage({ profile }: SynapseAchievementsPageProps) {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [scores, setScores] = useState<GameScoreRow[]>([]);
  const [manualAchievements, setManualAchievements] = useState<SynapseAchievement[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Project');
  const [description, setDescription] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [certificateDataUrl, setCertificateDataUrl] = useState('');
  const [achievedAt, setAchievedAt] = useState(new Date().toISOString().slice(0, 10));

  const readFileAsDataUrl = (file: File, onLoaded: (result: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!profile?.id) return;
    void fetchAchievementsList(profile.id).then(setManualAchievements);
  }, [profile?.id]);

  useEffect(() => {
    void loadData();
  }, [profile?.id, profile?.full_name]);

  const loadData = async () => {
    if (!profile?.id) return;

    try {
      const certificateQuery = supabase
        .from('certificates')
        .select('id, enrollment_id, student_id, mentor_id, course_id, issue_date, certificate_url, course:courses(title), mentor:profiles(full_name)')
        .eq('student_id', profile.id);

      const recommendationsQuery = supabase
        .from('recommendations')
        .select('id, mentor_id, student_id, content, created_at, mentor:profiles(full_name)')
        .eq('student_id', profile.id);

      const gameScoresQuery = supabase
        .from('game_scores')
        .select('id, game_type, score, created_at')
        .or(`player_id.eq.${profile.id},player_name.eq.${profile.full_name}`);

      const [
        { data: certificateRows, error: certificatesError },
        { data: recommendationRows, error: recommendationsError },
        { data: scoreRows, error: scoresError },
      ] = await Promise.all([certificateQuery, recommendationsQuery, gameScoresQuery]);

      if (certificatesError) throw certificatesError;
      if (recommendationsError) throw recommendationsError;
      if (scoresError) throw scoresError;

      setCertificates((certificateRows || []) as unknown as Certificate[]);
      setRecommendations((recommendationRows || []) as unknown as Recommendation[]);
      setScores((scoreRows || []) as GameScoreRow[]);
    } catch (error) {
      console.error('Failed to load achievements:', error);
      toast.error('Unable to load achievements right now.');
    }
  };

  const totalStats = useMemo(
    () => ({
      certificates: certificates.length,
      recommendations: recommendations.length,
      manual: manualAchievements.length,
      games: scores.length,
    }),
    [certificates.length, recommendations.length, manualAchievements.length, scores.length],
  );

  const bestGameScore = useMemo(() => {
    if (scores.length === 0) return 0;
    return Math.max(...scores.map((score) => score.score));
  }, [scores]);

  const handleAddAchievement = () => {
    if (!profile?.id) {
      toast.error('Sign in to manage achievements.');
      return;
    }

    if (!title.trim()) {
      toast.error('Add a title first.');
      return;
    }

    const next = [
      {
        id: createId('achievement'),
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        proofUrl: proofUrl.trim(),
        imageDataUrl,
        certificateDataUrl,
        achievedAt,
        createdAt: new Date().toISOString(),
      },
      ...manualAchievements,
    ];

    setManualAchievements(next);
    saveAchievements(profile.id, next);
    setTitle('');
    setCategory('Project');
    setDescription('');
    setProofUrl('');
    setImageDataUrl('');
    setCertificateDataUrl('');
    setAchievedAt(new Date().toISOString().slice(0, 10));
    toast.success('Achievement added.');
  };

  const handleDeleteAchievement = (id: string) => {
    if (!profile?.id) return;
    const next = manualAchievements.filter((item) => item.id !== id);
    setManualAchievements(next);
    saveAchievements(profile.id, next);
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
            <Award className="w-3.5 h-3.5" />
            Achievements
          </span>
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-text-primary">
              Turn Work Into A Portfolio
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
              Track verified course outcomes, mentor recommendations, game progress, and custom wins in one place.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Certificates" value={String(totalStats.certificates)} icon={<Award className="w-5 h-5" />} />
          <StatCard label="Recommendations" value={String(totalStats.recommendations)} icon={<Star className="w-5 h-5" />} />
          <StatCard label="Manual Entries" value={String(totalStats.manual)} icon={<PlusCircle className="w-5 h-5" />} />
          <StatCard label="Best Game Score" value={String(bestGameScore)} icon={<Medal className="w-5 h-5" />} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-text-primary">Add Custom Achievement</h2>
              <p className="text-sm text-text-secondary">Useful for hackathons, prototypes, research, and community wins.</p>
            </div>

            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Achievement title" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you achieve?" className="min-h-[120px] w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            <div className="grid gap-4 md:grid-cols-2">
              <input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="Proof link" className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
              <input type="date" value={achievedAt} onChange={(e) => setAchievedAt(e.target.value)} className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-dashed border-white/10 bg-bg-elevated p-4 text-sm text-text-secondary">
                <div className="font-semibold text-text-primary">Achievement photo</div>
                <p className="mt-1 text-xs">Upload a photo, poster, or screenshot.</p>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-3 block w-full text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) readFileAsDataUrl(file, setImageDataUrl);
                  }}
                />
              </label>
              <label className="rounded-2xl border border-dashed border-white/10 bg-bg-elevated p-4 text-sm text-text-secondary">
                <div className="font-semibold text-text-primary">Certificate or proof file</div>
                <p className="mt-1 text-xs">Upload an image or PDF preview source.</p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="mt-3 block w-full text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) readFileAsDataUrl(file, setCertificateDataUrl);
                  }}
                />
              </label>
            </div>
            {(imageDataUrl || certificateDataUrl) && (
              <div className="grid gap-4 md:grid-cols-2">
                {imageDataUrl && (
                  <img src={imageDataUrl} alt="Achievement preview" className="h-40 w-full rounded-2xl object-cover border border-white/8" />
                )}
                {certificateDataUrl && (
                  certificateDataUrl.startsWith('data:image') ? (
                    <img src={certificateDataUrl} alt="Certificate preview" className="h-40 w-full rounded-2xl object-cover border border-white/8" />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-2xl border border-white/8 bg-bg-elevated text-sm text-text-secondary">
                      Certificate file selected
                    </div>
                  )
                )}
              </div>
            )}
            <button onClick={handleAddAchievement} className="inline-flex items-center gap-2 rounded-2xl bg-accent-teal px-5 py-3 text-sm font-bold text-bg-base transition-all hover:bg-[#00f5b4]">
              <PlusCircle className="w-4 h-4" />
              Add Achievement
            </button>
          </div>

          <div className="space-y-6">
            <AchievementBlock
              title="Manual Portfolio Entries"
              emptyMessage="No custom achievements added yet."
              items={manualAchievements.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-text-primary">{item.title}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {item.category} • {item.achievedAt}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteAchievement(item.id)} className="text-text-secondary hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {item.description && <p className="mt-3 text-sm text-text-secondary">{item.description}</p>}
                  {item.imageDataUrl && (
                    <img src={item.imageDataUrl} alt={item.title} className="mt-3 h-40 w-full rounded-2xl object-cover border border-white/8" />
                  )}
                  {item.certificateDataUrl && (
                    item.certificateDataUrl.startsWith('data:image') ? (
                      <img src={item.certificateDataUrl} alt={`${item.title} certificate`} className="mt-3 h-40 w-full rounded-2xl object-cover border border-white/8" />
                    ) : (
                      <a href={item.certificateDataUrl} download={`${item.title}-certificate`} className="mt-3 inline-block text-sm font-semibold text-accent-teal">
                        Download certificate file
                      </a>
                    )
                  )}
                  {item.proofUrl && (
                    <a href={item.proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-accent-teal">
                      Open proof
                    </a>
                  )}
                </div>
              ))}
            />

            <AchievementBlock
              title="Verified Certificates"
              emptyMessage="No certificates found yet."
              items={certificates.map((certificate) => (
                <div key={certificate.id} className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                  <p className="font-semibold text-text-primary">{certificate.course?.title || 'Course certificate'}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Mentor: {certificate.mentor?.full_name || 'Unknown'} • {new Date(certificate.issue_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            />

            <AchievementBlock
              title="Recommendations and Game Progress"
              emptyMessage="No recommendations or game scores yet."
              items={[
                ...recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                    <p className="font-semibold text-text-primary">Recommendation</p>
                    <p className="mt-2 text-sm text-text-secondary">{recommendation.content}</p>
                    <p className="mt-3 text-xs text-text-secondary">
                      {recommendation.mentor?.full_name || 'Mentor'} • {new Date(recommendation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )),
                ...scores.slice(0, 6).map((score) => (
                  <div key={score.id} className="rounded-2xl border border-white/8 bg-bg-elevated p-4">
                    <p className="font-semibold text-text-primary">
                      {score.game_type[0].toUpperCase() + score.game_type.slice(1)} score
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">Score: {score.score}</p>
                    <p className="mt-3 text-xs text-text-secondary">
                      {new Date(score.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )),
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{label}</p>
        <div className="text-accent-teal">{icon}</div>
      </div>
      <p className="mt-4 font-display text-3xl font-black text-text-primary">{value}</p>
    </div>
  );
}

function AchievementBlock({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: React.ReactNode[];
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-bg-card p-6 space-y-4">
      <h2 className="font-display text-2xl font-bold text-text-primary">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-text-secondary">{emptyMessage}</p> : items}
    </div>
  );
}
