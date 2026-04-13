import { useEffect, useRef, useState } from "react";
import { useRuffles } from "@/contexts/ruffles";
import rufflesCat from "@assets/ruffles-cat.png";

const CAT_SIZE = 96;
const SPEED_MIN = 11;
const SPEED_MAX = 18;

type Cat = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomVelocity() {
  const mag = randomInRange(SPEED_MIN, SPEED_MAX);
  const angle = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(angle) * mag,
    vy: Math.sin(angle) * mag,
  };
}

export function DraggableRuffles() {
  const { showRuffles, spawnTrigger } = useRuffles();
  const [cats, setCats] = useState<Cat[]>([]);
  const nextId = useRef(0);
  const rafId = useRef<number | null>(null);

  // Clear cats when overlay is hidden (e.g. after refresh)
  useEffect(() => {
    if (!showRuffles) setCats([]);
  }, [showRuffles]);

  // Spawn a new cat at a random position with random velocity
  useEffect(() => {
    if (!showRuffles || spawnTrigger === 0) return;
    const padding = 40;
    const maxX = window.innerWidth - CAT_SIZE - padding * 2;
    const maxY = window.innerHeight - CAT_SIZE - padding * 2;
    const x = padding + (maxX > 0 ? Math.random() * maxX : 0);
    const y = padding + (maxY > 0 ? Math.random() * maxY : 0);
    const { vx, vy } = randomVelocity();
    setCats((prev) => [...prev, { id: nextId.current++, x, y, vx, vy }]);
  }, [showRuffles, spawnTrigger]);

  // Bounce physics loop
  useEffect(() => {
    if (!showRuffles) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const tick = () => {
      setCats((prev) => {
        if (prev.length === 0) return prev;
        return prev.map((cat) => {
          let { x, y, vx, vy } = cat;
          x += vx;
          y += vy;
          if (x <= 0) {
            x = 0;
            vx = Math.abs(vx);
          }
          if (x >= w - CAT_SIZE) {
            x = w - CAT_SIZE;
            vx = -Math.abs(vx);
          }
          if (y <= 0) {
            y = 0;
            vy = Math.abs(vy);
          }
          if (y >= h - CAT_SIZE) {
            y = h - CAT_SIZE;
            vy = -Math.abs(vy);
          }
          return { ...cat, x, y, vx, vy };
        });
      });
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [showRuffles]);

  if (!showRuffles) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {cats.map((cat) => (
        <img
          key={cat.id}
          src={rufflesCat}
          alt=""
          className="absolute w-24 h-24 object-contain select-none pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: CAT_SIZE,
            height: CAT_SIZE,
            transform: `translate3d(${Math.round(cat.x)}px, ${Math.round(cat.y)}px, 0)`,
            backfaceVisibility: "hidden",
            willChange: "transform",
          }}
          draggable={false}
        />
      ))}
    </div>
  );
}
