"use client";

import React, { useEffect, useState } from "react";

interface LiquidLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  speed?: number;
  glow?: boolean;
}

const GRADIENTS = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-purple-500",
  "from-cyan-400 to-blue-500",
  "from-green-400 to-cyan-400",
  "from-yellow-400 to-green-400",
  "from-orange-400 to-yellow-400",
  "from-red-500 to-orange-400",
];

const GLOW_COLORS = [
  "#a855f7",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#eab308",
  "#f97316",
  "#ef4444",
];

export default function LiquidLoading({
  className = "",
  size = "md",
  speed = 1,
  glow = true,
}: LiquidLoaderProps) {
  const [heights, setHeights] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [droplets, setDroplets] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;

    const tick = (timestamp: number) => {
      if (timestamp - lastUpdate >= 32) {
        lastUpdate = timestamp;
        const currentNow = Date.now();
        setNow(currentNow);

        setHeights(() =>
          GRADIENTS.map((_, i) => {
            const offset = i * 0.8;
            const t = currentNow * 0.001 * speed;
            const wave1 = Math.sin(t + offset);
            const wave2 = Math.sin(t * 4 + offset) * 0.15;
            const wave3 = Math.sin(t * 8 + offset) * 0.05;
            return 80 * (wave1 + wave2 + wave3);
          })
        );

        setDroplets(() =>
          GRADIENTS.map((_, i) => {
            const offset = i * 0.8;
            const t = currentNow * 0.001 * speed;
            return Math.sin(t + offset) > 0.8;
          })
        );
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [speed]);

  const scaleFactor = size === "sm" ? 0.6 : size === "lg" ? 1.3 : 1;
  const colWidth = size === "sm" ? "w-6" : size === "lg" ? "w-12" : "w-10";
  const gapClass = size === "sm" ? "space-x-2" : size === "lg" ? "space-x-6" : "space-x-4";

  return (
    <div
      className={`flex items-end justify-center ${gapClass} p-4 sm:p-8 select-none ${className}`}
      aria-label="Liquid loading indicator"
      role="status"
    >
      {heights.map((h, i) => {
        const glowColor = GLOW_COLORS[i];
        const isDroplet = droplets[i];
        const barHeight = Math.max(14, Math.abs(h) * scaleFactor);

        return (
          <div key={i} className="relative flex flex-col items-center">
            {/* Top Droplet */}
            <div
              className={`rounded-full bg-gradient-to-r ${GRADIENTS[i]} mb-2 sm:mb-3 transition-all duration-500 ease-out ${
                isDroplet ? "opacity-100" : "opacity-0"
              }`}
              style={{
                width: `${16 * scaleFactor}px`,
                height: `${16 * scaleFactor}px`,
                animationDelay: `${i * 0.2}s`,
                filter: "blur(0.5px)",
                transform: isDroplet
                  ? `translateY(${Math.sin(now * 0.008 + i * 0.5) * 3 * scaleFactor}px) scale(${
                      0.8 + Math.sin(now * 0.006 + i * 0.3) * 0.4
                    })`
                  : "translateY(10px) scale(0.5)",
                boxShadow: isDroplet && glow ? `0 0 15px ${glowColor}66` : "none",
              }}
            />

            {/* Main Liquid Capsule */}
            <div
              className={`${colWidth} bg-gradient-to-t ${GRADIENTS[i]} rounded-full transition-all duration-200 ease-out relative overflow-hidden shadow-lg`}
              style={{
                height: `${barHeight}px`,
                transform: h < 0 ? "scaleY(-1)" : "scaleY(1)",
                transformOrigin: "bottom",
                filter: "blur(0.3px)",
                boxShadow: glow
                  ? `0 0 20px ${glowColor}70, inset 0 0 20px rgba(255,255,255,0.15)`
                  : "none",
              }}
            >
              {/* Top glossy reflection cap */}
              <div
                className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/40 to-transparent rounded-full"
                style={{
                  transform: `translateY(${Math.sin(now * 0.003 + i * 0.5) * 1}px) scaleY(${
                    0.8 + Math.sin(now * 0.004 + i * 0.3) * 0.3
                  })`,
                }}
              />

              {/* Vertical ambient liquid sheen */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  transform: `translateY(${Math.sin(now * 0.002 + i * 0.5) * 2}px)`,
                  background:
                    "linear-gradient(0deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                }}
              />

              {/* Lateral sliding sheen */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full"
                style={{
                  transform: `translateX(${Math.sin(now * 0.0015 + i * 0.7) * 8}px)`,
                  width: "140%",
                  left: "-20%",
                }}
              />

              {/* Internal micro-droplet */}
              <div
                className="absolute w-2 h-2 bg-white/40 rounded-full"
                style={{
                  top: `${20 + Math.sin(now * 0.003 + i * 0.8) * 10}%`,
                  left: `${30 + Math.sin(now * 0.002 + i * 0.6) * 20}%`,
                  transform: `scale(${0.5 + Math.sin(now * 0.004 + i * 0.4) * 0.5})`,
                  opacity: Math.sin(now * 0.005 + i * 0.9) * 0.3 + 0.3,
                }}
              />
            </div>

            {/* Bottom Droplet */}
            <div
              className={`rounded-full bg-gradient-to-r ${GRADIENTS[i]} mt-2 transition-all duration-300`}
              style={{
                width: `${12 * scaleFactor}px`,
                height: `${12 * scaleFactor}px`,
                opacity: Math.sin(now * 0.003 + i * 0.9) * 0.4 + 0.6,
                transform: `scale(${0.6 + Math.sin(now * 0.002 + i * 0.6) * 0.4}) translateY(${
                  Math.sin(now * 0.004 + i * 0.8) * 1
                }px)`,
                filter: "blur(0.2px)",
                boxShadow: glow ? `0 2px 8px ${glowColor}50` : "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
export { LiquidLoading };
