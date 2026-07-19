import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/src/lib/utils';
import { ArrowRight, GraduationCap, Users, Award, Shield, BarChart3, Zap } from 'lucide-react';
import { useRef } from 'react';

const easeEmphasis = [0.16, 1, 0.3, 1] as const;
const easeSmooth = [0.22, 1, 0.36, 1] as const;

const sectionReveal = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: easeEmphasis },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 24, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: easeEmphasis },
  },
};

export default function LandingPage() {
  return (
    <>
      <div className="pt-32 space-y-24 pb-24 relative">
        <div className="pointer-events-none absolute -top-10 right-6 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(34,242,239,0.12),transparent_70%)]" />
        <div className="pointer-events-none absolute top-96 -left-10 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(201,35,248,0.1),transparent_70%)]" />
      {/* Hero Section */}
      <section id="home" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 grid lg:grid-cols-2 gap-16 items-center relative">
        <div className="space-y-8 lg:pr-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-teal/10 border border-accent-teal/20 shadow-[0_6px_20px_rgba(73,220,122,0.12)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse" />
            <span className="text-xs font-mono text-accent-teal tracking-wider uppercase">Now in Beta — Join learners</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-7xl font-extrabold leading-[0.9] tracking-tighter"
          >
            Where Learning<br />Becomes <span className="text-accent-teal">Social.</span>
          </motion.h1>

          <div className="h-1 w-20 rounded-full bg-gradient-to-r from-accent-teal via-accent-amber to-accent-purple" />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-text-secondary max-w-md leading-relaxed"
          >
            Unigram bridges the gap between education, mentorship, and collaboration — combining short-form learning with verified credentials and trusted recommendations.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              to="/auth"
              className="bg-accent-teal hover:brightness-110 text-bg-base px-8 py-4 rounded-2xl text-lg font-bold font-display transition-all hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(73,220,122,0.28)]"
            >
              Get Started Free
            </Link>
            <Link
              to="/feed"
              className="px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 hover:border-accent-amber hover:text-accent-amber hover:bg-accent-amber/5 transition-all"
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
          <div className="w-[320px] mx-auto bg-bg-card border border-white/10 rounded-[40px] p-4 shadow-2xl rotate-1">
            <div className="w-20 h-1.5 bg-bg-base rounded-full mx-auto mb-4" />
            <div className="aspect-[9/16] rounded-[24px] bg-bg-base overflow-hidden relative flex flex-col text-[10px]">
              {/* Mini Navbar */}
              <div className="flex items-center justify-between px-3 py-2 bg-bg-surface border-b border-white/5">
                <span className="font-display font-bold text-accent-teal text-[11px]">Unigram</span>
                <div className="flex gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-white/10" />
                  <div className="w-4 h-4 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Mini Feed - scrolling content */}
              <div className="flex-1 overflow-hidden px-2.5 py-2 space-y-2">
                {/* Mini Post Card */}
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="space-y-2"
                >
                  <div className="bg-bg-card rounded-xl p-2.5 border border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-accent-teal/20 flex items-center justify-center text-[7px]">👩‍🏫</div>
                      <div>
                        <p className="font-bold text-[8px] leading-none">Dr. Priya Nair</p>
                        <p className="text-text-muted text-[6px]">System Design · 2h ago</p>
                      </div>
                    </div>
                    <div className="w-full h-16 rounded-lg bg-gradient-to-br from-[#0c1f1a] via-[#0f1d2a] to-[#0a1528] flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border border-accent-teal/40 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[5px] border-l-accent-teal/60 border-y-[3px] border-y-transparent ml-0.5" />
                      </div>
                    </div>
                    <div className="flex gap-3 text-text-muted text-[7px]">
                      <span>❤️ 234</span><span>💬 18</span><span>🔖</span>
                    </div>
                  </div>

                  {/* Mini Course Card */}
                  <div className="bg-bg-card rounded-xl p-2.5 border border-white/5 space-y-1.5">
                    <p className="text-[7px] font-mono text-accent-teal uppercase tracking-wider">Enrolled Course</p>
                    <p className="font-display font-bold text-[9px]">React Advanced Patterns</p>
                    <div className="w-full h-1 rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-accent-teal"
                        initial={{ width: '30%' }}
                        animate={{ width: '72%' }}
                        transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                      />
                    </div>
                    <p className="text-text-muted text-[7px]">72% complete · 5 lessons left</p>
                  </div>

                  {/* Mini Certificate */}
                  <div className="bg-gradient-to-br from-accent-teal/10 to-accent-purple/10 rounded-xl p-2.5 border border-accent-teal/15 space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">🎓</span>
                      <p className="font-display font-bold text-[9px] text-accent-teal">New Certificate!</p>
                    </div>
                    <p className="text-[8px]">Web Dev Mastery</p>
                    <p className="text-text-muted text-[6px]">Signed by Prof. Alex Chen</p>
                  </div>

                  {/* Mini Mentor Card */}
                  <div className="bg-bg-card rounded-xl p-2.5 border border-white/5">
                    <p className="text-[7px] font-mono text-accent-purple uppercase tracking-wider mb-1.5">Recommended</p>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent-purple/20 flex items-center justify-center text-[10px]">👨‍💻</div>
                      <div>
                        <p className="font-bold text-[8px]">Prof. Alex Chen</p>
                        <p className="text-text-muted text-[6px]">AI & Machine Learning</p>
                      </div>
                      <div className="ml-auto px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple text-[6px] font-bold">Follow</div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Mini Bottom Nav */}
              <div className="flex items-center justify-around px-2 py-1.5 bg-bg-surface border-t border-white/5">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-3 h-3 rounded-sm bg-accent-teal/40" />
                  <span className="text-[5px] text-accent-teal font-bold">Feed</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-3 h-3 rounded-sm bg-white/10" />
                  <span className="text-[5px] text-text-muted">Courses</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-3 h-3 rounded-sm bg-white/10" />
                  <span className="text-[5px] text-text-muted">Games</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-3 h-3 rounded-sm bg-white/10" />
                  <span className="text-[5px] text-text-muted">Profile</span>
                </div>
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
      <motion.section
        id="purpose"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.2 }}
      >
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">The Problem</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">Three Critical Gaps in Education</h2>
        </div>

        <motion.div
          className="grid md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.15 }}
        >
          <GapCard 
            number="01"
            title="ONLINE STREAMING PLATFORMS — No Credibility"
            description="Videos Might not align with subject courses. There's no way to determine if a mentor actually knows what they're teaching, and no verifiable proof of learning."
          />
          <GapCard 
            number="02"
            title="NETWORKING PLATFORMS  — No Proof of Skill"
            description="Recommendations are vague and lack substance. Certifications are self-reported with no verification. Recruiters cannot trust the authenticity of credentials."
          />
          <GapCard 
            number="03"
            title="ONLINE LEARNING PLATFORMS     — No Real Relationships"
            description="Students complete courses from faceless platforms. No personal mentor-student interaction. Courses are transactional; mentors don't know student names."
          />
        </motion.div>
      </motion.section>

      {/* Solution Section (Pillars) */}
      <motion.section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0, scale: 0.96, y: 40 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: easeSmooth }}
        viewport={{ once: false, amount: 0.15 }}
      >
        <div className="bg-bg-card border border-white/5 rounded-[48px] p-12 md:p-20 relative overflow-hidden shadow-[0_24px_60px_rgba(4,10,10,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/8 via-transparent to-accent-purple/8" />
          <div className="absolute -top-16 right-12 w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(73,220,122,0.18),transparent_70%)]" />
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-start">
            <motion.div
              className="space-y-7"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: easeSmooth }}
              viewport={{ once: false }}
            >
              <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">The Unigram Solution</span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter max-w-sm leading-tight">Three Foundational Pillars</h2>
              <p className="text-lg text-text-secondary leading-relaxed max-w-sm">                
                Unigram bridges all three gaps through a unified platform built on credibility, verification, and real human connection.
              </p>
            </motion.div>

            <motion.div
              className="space-y-6"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.2 }}
            >
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
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Features Section - This is what "About Us" links to */}
      <motion.section
        id="about"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.15 }}
      >
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">What makes us different</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">Built for the future of learning</h2>
        </div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.1 }}
        >
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
        </motion.div>
      </motion.section>

      {/* Roles Section */}
      <motion.section
        id="roles"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.2 }}
      >
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-mono text-accent-teal tracking-widest uppercase">Choose your path</span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter">Who is Unigram for?</h2>
        </div>

        <motion.div
          className="grid md:grid-cols-2 gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.15 }}
        >
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
              "Collaborate with peers and mentors"
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
        </motion.div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 50, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: easeSmooth }}
        viewport={{ once: false, amount: 0.2 }}
      >
        <div className="bg-bg-card border border-white/5 rounded-[32px] p-12 md:p-20 text-center relative overflow-hidden shadow-[0_24px_60px_rgba(4,10,10,0.45)]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-accent-teal to-transparent" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(34,242,239,0.16),transparent_70%)]" />
          
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
                className="bg-accent-teal hover:brightness-110 text-bg-base px-8 py-4 rounded-2xl text-lg font-bold font-display transition-all hover:-translate-y-1"
              >
                Create Free Account
              </Link>
              <Link
                to="/dashboard"
                className="px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 hover:border-accent-amber hover:text-accent-amber transition-all"
              >
                See Mentor Dashboard
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.footer
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 border-t border-white/5 text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: false }}
      >
        <p className="text-sm text-text-muted">
          © 2025 Unigram · Built by Team-3 (Jebarson) · <span className="text-accent-teal font-mono">Where learning becomes social, and social becomes credible.</span>
        </p>
      </motion.footer>
    </div>
    </>
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
      className={cn("absolute bg-bg-card border border-white/10 rounded-2xl p-4 shadow-[0_20px_40px_rgba(4,10,10,0.45)] z-20 min-w-[180px]", className)}
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
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-6 shadow-[0_18px_36px_rgba(4,10,10,0.4)] hover:border-accent-teal/20 transition-colors"
    >
      <div className="text-4xl font-display font-extrabold text-accent-teal/20">{number}</div>
      <h3 className="text-xl font-display font-bold">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </motion.div>
  );
}

function PillarItem({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      variants={staggerItem}
      className="space-y-2 pl-6 border-l-2 border-accent-teal/20 hover:border-accent-teal/60 transition-colors"
    >
      <h3 className="text-xl font-display font-bold text-accent-teal">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </motion.div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: string; title: string; description: string; color: 'teal' | 'purple' | 'amber' }) {
  const colors = {
    teal: 'bg-accent-teal/10 text-accent-teal',
    purple: 'bg-accent-purple/10 text-accent-purple',
    amber: 'bg-accent-amber/10 text-accent-amber',
  };

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -5, transition: { duration: 0.25 } }}
      className="bg-bg-card border border-white/5 rounded-3xl p-8 hover:border-accent-teal/20 transition-colors group"
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-6", colors[color])}>
        {icon}
      </div>
      <h3 className="text-xl font-display font-bold mb-3 group-hover:text-accent-teal transition-colors">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </motion.div>
  );
}

function RoleCard({ role, icon, title, description, features }: { role: 'student' | 'mentor'; icon: React.ReactNode; title: string; description: string; features: string[] }) {
  const isStudent = role === 'student';
  
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ scale: 1.02, transition: { duration: 0.25 } }}
      className={cn(
      "role-card rounded-[32px] p-10 border transition-colors cursor-pointer group",
      isStudent 
        ? "role-card-student border-accent-teal/15" 
        : "role-card-mentor border-accent-purple/15"
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
        to={isStudent ? "/auth?mode=register&role=student" : "/auth?mode=register&role=mentor"}
        className={cn(
          "inline-flex items-center justify-center w-full py-4 rounded-2xl font-bold font-display transition-all",
          isStudent 
            ? "bg-accent-teal text-bg-base hover:brightness-110" 
            : "bg-accent-purple text-white hover:brightness-110"
        )}
      >
        Explore as {title} <ArrowRight className="ml-2 w-5 h-5" />
      </Link>
    </motion.div>
  );
}

