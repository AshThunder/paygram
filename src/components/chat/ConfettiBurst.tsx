import { useEffect, useState } from 'react';

const PARTICLES = ['💵', '✨', '🎉', '💚', '✅', '💸'];

type Particle = {
  id: number;
  emoji: string;
  left: number;
  top: number;
  delay: number;
};

export function ConfettiBurst({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    setParticles(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        emoji: PARTICLES[Math.floor(Math.random() * PARTICLES.length)]!,
        left: 20 + Math.random() * 60,
        top: 10 + Math.random() * 30,
        delay: Math.random() * 200,
      })),
    );
    const t = window.setTimeout(() => setParticles([]), 1200);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!particles.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-particle absolute text-sm"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}ms`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
