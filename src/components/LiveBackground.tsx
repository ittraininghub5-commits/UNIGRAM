import { motion } from 'motion/react';
import { useMemo } from 'react';

export default function LiveBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Aurora streaks */}
      <motion.div
        className="absolute -top-[30%] -left-[10%] w-[70vw] h-[60vh] rounded-full blur-[140px]"
        style={{ background: 'conic-gradient(from 180deg, #e6ff2f33, #7f8cff44, #e6ff2f22, transparent)', willChange: 'transform' }}
        animate={{ rotate: [0, 360], scale: [1, 1.08, 1] }}
        transition={{ rotate: { duration: 60, repeat: Infinity, ease: 'linear' }, scale: { duration: 14, repeat: Infinity, ease: 'easeInOut' } }}
      />
      <motion.div
        className="absolute -bottom-[20%] -right-[15%] w-[65vw] h-[55vh] rounded-full blur-[120px]"
        style={{ background: 'conic-gradient(from 60deg, #7f8cff44, #e6ff2f33, #f4ff7322, transparent)', willChange: 'transform' }}
        animate={{ rotate: [360, 0], scale: [1, 1.1, 1] }}
        transition={{ rotate: { duration: 70, repeat: Infinity, ease: 'linear' }, scale: { duration: 16, repeat: Infinity, ease: 'easeInOut' } }}
      />
      <motion.div
        className="absolute top-[40%] left-[20%] w-[50vw] h-[50vh] rounded-full blur-[160px]"
        style={{ background: 'radial-gradient(circle, rgba(127,140,255,0.2), transparent 70%)', willChange: 'transform' }}
        animate={{ x: ['-3%', '6%', '-3%'], y: ['-3%', '5%', '-3%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Animated mesh grid */}
      <motion.div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(230,255,47,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(127,140,255,0.4) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          willChange: 'background-position',
        }}
        animate={{ backgroundPosition: ['0px 0px', '80px 80px'] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")" }} />
    </div>
  );
}

function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 1.5,
      x: Math.random() * 100,
      startY: Math.random() * 100,
      duration: Math.random() * 20 + 18,
      delay: Math.random() * 12,
      opacity: Math.random() * 0.3 + 0.08,
      color: ['#e6ff2f', '#7f8cff', '#f4ff73', '#ffffff'][Math.floor(Math.random() * 4)],
    })),
  []);

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.startY}%`,
            backgroundColor: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            willChange: 'transform, opacity',
          }}
          animate={{
            y: [0, -60, -15, -90, 0],
            x: [0, 15, -10, 8, 0],
            opacity: [p.opacity, p.opacity * 1.4, p.opacity * 0.7, p.opacity * 1.2, p.opacity],
            scale: [1, 1.15, 0.9, 1.05, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </>
  );
}
