import React, { useState } from "react";
import pdiLogoHorizontalAsset from "../../assets/images/pdi_logo_horizontal_1786833058854.jpg";
import pdiLogoSquareAsset from "../../assets/images/pdi_logo_square_1786833049529.jpg";
import {
  PDI_LOGO_HORIZONTAL_DATA_URL,
  PDI_LOGO_SQUARE_DATA_URL,
} from "../../assets/pdiLogos";

// PD&I — Logo officiel certifié ISO (Public root + Vite asset + Base64 fallbacks)
const HORIZONTAL_SOURCES = [
  "/pdi-logo-horizontal.png",
  "/pdi-logo-horizontal.jpg",
  pdiLogoHorizontalAsset,
  PDI_LOGO_HORIZONTAL_DATA_URL,
  "/pdi-logo-horizental.jpeg",
];

const SQUARE_SOURCES = [
  "/pdi-logo-square.png",
  "/pdi-logo-square.jpg",
  pdiLogoSquareAsset,
  PDI_LOGO_SQUARE_DATA_URL,
  "/pdo-logo-square.jpeg",
];

export type PdiBrandMarkProps = {
  variant?: "horizontal" | "compact" | "square";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
  title?: string;
  maxHeight?: number;
};

export default function PdiBrandMark({
  variant = "horizontal",
  size = "md",
  className = "",
  onClick,
  title = "PD&I — Piping Design & Isometrics",
  maxHeight,
}: PdiBrandMarkProps) {
  const compact = variant === "compact" || variant === "square";
  const sources = compact ? SQUARE_SOURCES : HORIZONTAL_SOURCES;
  const [srcIndex, setSrcIndex] = useState(0);

  const defaultHeight =
    size === "xs"
      ? 26
      : size === "sm"
      ? 36
      : size === "md"
      ? 48
      : size === "lg"
      ? 64
      : 84;

  const height = maxHeight || defaultHeight;
  const currentSrc = sources[Math.min(srcIndex, sources.length - 1)];

  return (
    <div
      className={`pdi-brand-mark inline-flex items-center select-none ${className} ${onClick ? "cursor-pointer" : ""}`}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      <img
        src={currentSrc}
        alt={title}
        onError={() => setSrcIndex((idx) => Math.min(idx + 1, sources.length - 1))}
        style={{
          height,
          width: compact ? height : undefined,
          maxWidth: compact ? height : "min(320px, 40vw)",
          objectFit: "contain",
          display: "block",
          borderRadius: compact ? "8px" : "6px",
        }}
        loading="eager"
        decoding="sync"
        draggable={false}
      />
    </div>
  );
}

