"use client";

import React, { useEffect, useRef, useState } from "react";

export interface GlowingEffectProps {
  spread?: number;
  glow?: boolean;
  disabled?: boolean;
  proximity?: number;
  inactiveZone?: number;
  borderWidth?: number;
  className?: string;
  variant?: "default" | "white";
  movementDuration?: number;
}

export function GlowingEffect({
  spread = 40,
  glow = true,
  disabled = false,
  proximity = 64,
  inactiveZone = 0.01,
  borderWidth = 1,
  className = "",
  variant = "default",
}: GlowingEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: -1000, y: -1000 });
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (disabled) return;

    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const isNear =
        x >= -proximity &&
        x <= rect.width + proximity &&
        y >= -proximity &&
        y <= rect.height + proximity;

      if (isNear) {
        setPosition({ x, y });
        setOpacity(1);
      } else {
        setOpacity(0);
      }
    };

    const handleMouseLeave = () => {
      setOpacity(0);
    };

    parent.addEventListener("mousemove", handleMouseMove);
    parent.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      parent.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [disabled, proximity]);

  if (disabled) return null;

  const glowGradient =
    variant === "white"
      ? `radial-gradient(${spread * 4}px circle at ${position.x}px ${position.y}px, rgba(255, 255, 255, 0.8), transparent 70%)`
      : `radial-gradient(${spread * 4}px circle at ${position.x}px ${position.y}px, rgba(56, 189, 248, 0.85), rgba(99, 102, 241, 0.65), rgba(236, 72, 153, 0.45), transparent 70%)`;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300 ${className}`}
      style={{ opacity }}
    >
      {/* Outer border glow stroke using mask */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          padding: `${borderWidth}px`,
          background: glowGradient,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Subtle background glow */}
      {glow && (
        <div
          className="absolute inset-0 rounded-[inherit] opacity-25 blur-lg transition-all"
          style={{
            background: glowGradient,
          }}
        />
      )}
    </div>
  );
}
