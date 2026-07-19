import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Target,
  Briefcase,
  GitBranch,
  Sparkles,
  UserPlus,
  Search,
  Handshake,
  Trophy,
} from 'lucide-react';
import { safeNavigateBack } from '@/src/lib/navigation';

const pillars = [
  {
    icon: Users,
    title: 'Skill-Based Discovery',
    description:
      'Students can surface their strengths, interests, and project experience so the right collaborators are easier to find.',
  },
  {
    icon: Target,
    title: 'Balanced Team Formation',
    description:
      'The report centers on forming stronger academic teams by matching complementary skills instead of relying on social circles alone.',
  },
  {
    icon: Briefcase,
    title: 'Portfolio Visibility',
    description:
      'Projects, contributions, and practical outcomes become visible artifacts students can use for credibility and career growth.',
  },
];

const flow = [
  {
    step: 1,
    label: 'Create',
    icon: UserPlus,
    description: 'Create a profile with strengths, interests, and availability.',
    route: '/collab/create',
    cardClass: 'border-white/8 bg-bg-elevated hover:border-white/15 hover:bg-bg-card hover:shadow-[0_18px_36px_rgba(4,10,10,0.28)]',
    iconClass: 'bg-accent-teal/10 text-accent-teal',
    buttonClass: 'border-white/10 bg-bg-elevated hover:border-accent-teal/40 hover:bg-bg-card hover:text-accent-teal',
  },
  {
    step: 2,
    label: 'Discover',
    icon: Search,
    description: 'Discover peers through skill visibility and context-aware matching.',
    route: '/collab/discover',
    cardClass: 'border-white/8 bg-bg-elevated hover:border-white/15 hover:bg-bg-card hover:shadow-[0_18px_36px_rgba(4,10,10,0.28)]',
    iconClass: 'bg-accent-teal/10 text-accent-teal',
    buttonClass: 'border-white/10 bg-bg-elevated hover:border-accent-teal/40 hover:bg-bg-card hover:text-accent-teal',
  },
  {
    step: 3,
    label: 'Collab',
    icon: Handshake,
    description: 'Form teams around events, projects, and cross-disciplinary goals.',
    route: '/collab/connect',
    cardClass: 'border-white/8 bg-bg-elevated hover:border-white/15 hover:bg-bg-card hover:shadow-[0_18px_36px_rgba(4,10,10,0.28)]',
    iconClass: 'bg-accent-teal/10 text-accent-teal',
    buttonClass: 'border-white/10 bg-bg-elevated hover:border-accent-teal/40 hover:bg-bg-card hover:text-accent-teal',
  },
  {
    step: 4,
    label: 'Achievements',
    icon: Trophy,
    description: 'Showcase outcomes as a living academic portfolio.',
    route: '/collab/achievements',
    cardClass: 'border-white/8 bg-bg-elevated hover:border-white/15 hover:bg-bg-card hover:shadow-[0_18px_36px_rgba(4,10,10,0.28)]',
    iconClass: 'bg-accent-teal/10 text-accent-teal',
    buttonClass: 'border-white/10 bg-bg-elevated hover:border-accent-teal/40 hover:bg-bg-card hover:text-accent-teal',
  },
];

export default function SynapsePage() {
  const navigate = useNavigate();

  return (
    <div className="pt-20 pb-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <button
          onClick={() => safeNavigateBack(navigate, '/feed')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-bg-card p-8 md:p-10 shadow-[0_20px_44px_rgba(4,10,10,0.28)]">
          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-accent-teal">
                <Sparkles className="w-3.5 h-3.5" />
                Helps to connect
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-bg-elevated px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] text-text-secondary">
                Student Peer-to-Peer Skill Exchange Platform
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight text-text-primary">
                Collab
              </h1>
            </div>

            {/* Pillars inside hero */}
            <div className="grid gap-4 md:grid-cols-3">
              {pillars.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/8 bg-bg-elevated/70 p-5 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent-teal/10 text-accent-teal flex items-center justify-center mb-4">
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-accent-teal mb-2">
                    {title}
                  </p>
                  <p className="text-sm leading-7 text-text-secondary">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FLOW SECTION */}
        <section className="rounded-3xl border border-white/8 bg-bg-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-accent-teal/10 text-accent-teal flex items-center justify-center">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-text-primary">How Collab Flows</h2>
              <p className="text-sm text-text-secondary">
                Four steps from profile to portfolio.
              </p>
            </div>
          </div>

          {/* Step cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {flow.map(({ step, label, icon: Icon, description, cardClass, iconClass }) => (
              <div
                key={label}
                className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 ${cardClass}`}
              >
                {/* Step number top right */}
                <span className="absolute top-4 right-4 text-[11px] font-mono text-text-muted">
                  0{step}
                </span>

                {/* Icon */}
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                <div>
                  <p className="font-display text-lg font-bold text-text-primary">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Connector line + buttons row */}
          <div className="relative">
            {/* Faint connector line behind buttons on desktop */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-white/8 -translate-y-1/2 mx-6" />

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 relative">
              {flow.map(({ label, icon: Icon, route, buttonClass }) => (
                <button
                  key={label}
                  onClick={() => navigate(route)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold text-text-primary transition-all ${buttonClass}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
