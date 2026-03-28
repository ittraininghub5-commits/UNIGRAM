import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { ArrowRight, GraduationCap, Users, Award, Shield, BarChart3, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-teal/10 border border-accent-teal/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse" />
            <span className="text-xs font-mono text-accent-teal tracking-wider uppercase">Now in Beta — Join 2,400+ learners</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-7xl font-extrabold leading-[0.9] tracking-tighter"
          >
            Where Learning<br />Becomes <span className="text-accent-teal">Social.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-text-secondary max-w-md leading-relaxed"
          >
            Unigram bridges the gap between education, mentorship, and employability — combining short-form learning with verified credentials and trusted recommendations.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              to="/auth"
              className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-8 py-4 rounded-2xl text-lg font-bold font-display transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,217,160,0.25)]"
            >
              Get Started Free
            </Link>
            <Link
              to="/feed"
              className="px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 hover:border-accent-teal hover:text-accent-teal hover:bg-accent-teal/5 transition-all"
            >
              Explore Feed <ArrowRight className="inline-block ml-2 w-5 h-5" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="pt-8 border-t border-white/5 flex gap-12"
          >
            <Stat value="2,400+" label="Students" />
            <Stat value="340+" label="Mentors" />
            <Stat value="1,800+" label="Certs Issued" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative hidden lg:block"
        >
          <div className="w-[320px] mx-auto bg-bg-card border border-white/10 rounded-[40px] p-4 shadow-2xl">
            <div className="w-20 h-1.5 bg-bg-base rounded-full mx-auto mb-4" />
            <div className="aspect-[9/16] rounded-[24px] bg-bg-elevated overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0F2A20] via-[#142035] to-[#0A1528]" />
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,217,160,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,217,160,0.2) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-base/90 to-transparent">
                <p className="font-display font-bold text-sm">Dr. Priya Nair</p>
                <p className="text-[10px] text-text-secondary">System Design Fundamentals · Lesson 4</p>
              </div>
            </div>
          </div>

          <FloatingCard 
            className="top-10 -right-10"
            title="New Certificate"
            icon="🎓"
            subtitle="Web Dev Mastery"
          />
          <FloatingCard 
            className="bottom-20 -left-10"
            title="Your Rank"
            icon="#12"
            subtitle="Top learner this week"
          />
        </motion.div>
      </section>

      {/* Problem Section (Gaps) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">The Problem</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">Three Critical Gaps in Education</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <GapCard 
            number="01"
            title="YouTube — No Credibility"
            description="Anyone can post anything without verification. There's no way to determine if a mentor actually knows what they're teaching, and no verifiable proof of learning."
          />
          <GapCard 
            number="02"
            title="LinkedIn — No Proof of Skill"
            description="Recommendations are vague and lack substance. Certifications are self-reported with no verification. Recruiters cannot trust the authenticity of credentials."
          />
          <GapCard 
            number="03"
            title="Udemy — No Real Relationships"
            description="Students complete courses from faceless platforms. No personal mentor-student interaction. Courses are transactional; mentors don't know student names."
          />
        </div>
      </section>

      {/* Solution Section (Pillars) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-bg-card border border-white/5 rounded-[48px] p-12 md:p-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/5 to-transparent" />
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">The Unigram Solution</span>
              <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter">Three Foundational Pillars</h2>
              <p className="text-lg text-text-secondary leading-relaxed">
                Unigram bridges all three gaps through a unified platform built on credibility, verification, and real human connection.
              </p>
            </div>

            <div className="space-y-6">
              <PillarItem 
                title="1. Verified Mentors"
                description="Only approved professionals with verified credentials can teach. Every lesson comes with a real name and professional reputation."
              />
              <PillarItem 
                title="2. Mentor-Signed Certificates"
                description="Certifications are issued only after successful course completion. A real person reviews the student's work and puts their name on it."
              />
              <PillarItem 
                title="3. Built-in Relationships"
                description="Students follow mentors and maintain ongoing relationships. Real mentorship creates real credibility and professional growth."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">What makes us different</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">Built for the future of learning</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon="🎬" 
            title="Short-form Learning" 
            description="Bite-sized educational videos designed for deep engagement — not endless scrolling. Every video connects to a structured course path."
            color="teal"
          />
          <FeatureCard 
            icon="🧑‍🏫" 
            title="Mentor-backed Credentials" 
            description="Certifications signed and issued by verified mentors and professors. Recruiters trust what they see — because real experts stand behind it."
            color="purple"
          />
          <FeatureCard 
            icon="📋" 
            title="Verified Recommendations" 
            description="Professional recommendations written directly by your mentors after completing their courses. Acts as proof of real skill and eligibility."
            color="amber"
          />
          <FeatureCard 
            icon="🔒" 
            title="Role-based Security" 
            description="Students, Mentors, and Recruiters each have tailored permissions and verified access — keeping credibility at the core of every interaction."
            color="teal"
          />
          <FeatureCard 
            icon="📊" 
            title="Progress Tracking" 
            description="Visualize your learning journey with real-time progress dashboards. Know exactly where you stand in every enrolled course."
            color="purple"
          />
          <FeatureCard 
            icon="⚡" 
            title="Real-time Feed" 
            description="Stay updated with mentor content, peer achievements, and course launches through a dynamic, personalized feed built on real-time data."
            color="amber"
          />
        </div>
      </section>

      {/* Roles Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">Choose your path</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">Who is Unigram for?</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <RoleCard 
            role="student"
            icon={<GraduationCap className="w-12 h-12 text-accent-teal" />}
            title="Student"
            description="Build skills, earn verified credentials, and get recommendations from real mentors — all in one place."
            features={[
              "Browse & follow expert mentors",
              "Watch educational short videos",
              "Enroll in structured courses",
              "Earn mentor-signed certifications",
              "Request job recommendations"
            ]}
          />
          <RoleCard 
            role="mentor"
            icon={<Users className="w-12 h-12 text-accent-purple" />}
            title="Mentor"
            description="Share your expertise, manage courses, and build a verified professional presence that students and recruiters trust."
            features={[
              "Create verified professional profile",
              "Upload educational short videos",
              "Design and manage courses",
              "Issue mentor-signed certificates",
              "Write professional recommendations"
            ]}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-bg-card border border-white/5 rounded-[32px] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-accent-teal to-transparent" />
          
          <div className="relative z-10 space-y-8">
            <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">Start today</span>
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter max-w-3xl mx-auto">
              Social becomes credible.<br />Learning becomes social.
            </h2>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              Join thousands of students and mentors already building the future on Unigram.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/auth"
                className="bg-accent-teal hover:bg-[#00f5b4] text-bg-base px-8 py-4 rounded-2xl text-lg font-bold font-display transition-all hover:-translate-y-1"
              >
                Create Free Account
              </Link>
              <Link
                to="/dashboard"
                className="px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 hover:border-accent-teal transition-all"
              >
                See Mentor Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 border-t border-white/5 text-center">
        <p className="text-sm text-text-muted">
          © 2025 Unigram · Built by Team-3 (Jebarson) · <span className="text-accent-teal font-mono">Where learning becomes social, and social becomes credible.</span>
        </p>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="text-3xl font-display font-extrabold tracking-tighter">{value}</div>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}

function FloatingCard({ className, title, icon, subtitle }: { className?: string; title: string; icon: string; subtitle: string }) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className={cn("absolute bg-bg-card border border-white/10 rounded-2xl p-4 shadow-2xl z-20 min-w-[180px]", className)}
    >
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">{title}</p>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <p className="text-sm font-bold text-accent-teal leading-tight">{subtitle}</p>
      </div>
    </motion.div>
  );
}

function GapCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-6">
      <div className="text-4xl font-display font-extrabold text-accent-teal/20">{number}</div>
      <h3 className="text-xl font-display font-bold">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function PillarItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xl font-display font-bold text-accent-teal">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: string; title: string; description: string; color: 'teal' | 'purple' | 'amber' }) {
  const colors = {
    teal: 'bg-accent-teal/10 text-accent-teal',
    purple: 'bg-accent-purple/10 text-accent-purple',
    amber: 'bg-accent-amber/10 text-accent-amber',
  };

  return (
    <div className="bg-bg-card border border-white/5 rounded-3xl p-8 hover:border-accent-teal/20 transition-all group">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-6", colors[color])}>
        {icon}
      </div>
      <h3 className="text-xl font-display font-bold mb-3 group-hover:text-accent-teal transition-colors">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function RoleCard({ role, icon, title, description, features }: { role: 'student' | 'mentor'; icon: React.ReactNode; title: string; description: string; features: string[] }) {
  const isStudent = role === 'student';
  
  return (
    <div className={cn(
      "rounded-[32px] p-10 border transition-all hover:scale-[1.01] cursor-pointer group",
      isStudent 
        ? "bg-gradient-to-br from-[#091A28] to-[#0D1F38] border-accent-teal/15" 
        : "bg-gradient-to-br from-[#140D28] to-[#1A1038] border-accent-purple/15"
    )}>
      <div className="mb-6">{icon}</div>
      <h3 className={cn("text-3xl font-display font-extrabold mb-4", isStudent ? "text-accent-teal" : "text-accent-purple")}>
        {title}
      </h3>
      <p className="text-text-secondary mb-8 leading-relaxed">{description}</p>
      
      <ul className="space-y-4 mb-10">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-text-secondary">
            <ArrowRight className={cn("w-4 h-4", isStudent ? "text-accent-teal" : "text-accent-purple")} />
            {f}
          </li>
        ))}
      </ul>

      <Link
        to={isStudent ? "/feed" : "/dashboard"}
        className={cn(
          "inline-flex items-center justify-center w-full py-4 rounded-2xl font-bold font-display transition-all",
          isStudent 
            ? "bg-accent-teal text-bg-base hover:bg-[#00f5b4]" 
            : "bg-accent-purple text-white hover:bg-[#9d85f9]"
        )}
      >
        Explore as {title} <ArrowRight className="ml-2 w-5 h-5" />
      </Link>
    </div>
  );
}
