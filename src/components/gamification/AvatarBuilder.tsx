"use client";

import { useLabels } from "@/hooks/useLabels";
import { calculateAvatarDetails, DominantClass, AvatarTier } from "@/lib/avatar-calculator";

interface AvatarBuilderProps {
  warriorCompletions: number;
  mageCompletions: number;
  rogueCompletions: number;
  size?: number; // Size in pixels
}

export default function AvatarBuilder({
  warriorCompletions,
  mageCompletions,
  rogueCompletions,
  size = 96,
}: AvatarBuilderProps) {
  const labels = useLabels();
  
  const { dominantClass, tier, highestCount } = calculateAvatarDetails(
    warriorCompletions,
    mageCompletions,
    rogueCompletions
  );

  // Map class name to theme-consistent label
  const getClassLabel = (c: DominantClass) => {
    switch (c) {
      case "warrior":
        return labels.classWarrior;
      case "mage":
        return labels.classMage;
      case "rogue":
        return labels.classRogue;
      case "balanced":
        return "Balanced";
      default:
        return "";
    }
  };

  // Map cosmetic tier name to theme-consistent difficulty label
  const getTierLabel = (t: AvatarTier) => {
    switch (t) {
      case "novice-look":
        return labels.difficultyNovice;
      case "adept-look":
        return labels.difficultyAdept;
      case "master-look":
        return labels.difficultyMaster;
      default:
        return "";
    }
  };

  const classLabel = getClassLabel(dominantClass);
  const tierLabel = getTierLabel(tier);
  const titleText = `${tierLabel} ${classLabel}`;

  // Theme-aware color variables mapping based on dominant class
  const getAccentColor = (c: DominantClass) => {
    switch (c) {
      case "warrior":
        return "var(--accent-gold)";
      case "mage":
        return "var(--accent-teal)";
      case "rogue":
        return "var(--accent-purple)";
      case "balanced":
        return "var(--text-secondary)";
      default:
        return "var(--text-muted)";
    }
  };

  const accentColor = getAccentColor(dominantClass);

  return (
    <div
      className="flex flex-col items-center justify-center p-4 rounded-xl border relative overflow-hidden group transition-all duration-300"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
        width: size + 48,
        height: size + 84,
      }}
      title={titleText}
    >
      {/* Dynamic Background Glow representing the dominant class accent */}
      <div
        className="absolute inset-0 w-full h-full opacity-5 pointer-events-none transition-all duration-500 group-hover:opacity-10"
        style={{
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
        }}
      />

      {/* SVG Layer System */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-500 group-hover:scale-105"
      >
        {/* Layer 1: Accessory Layer (Back / Background Accents) */}
        {tier === "adept-look" && (
          // Adept background glow rings
          <g opacity="0.6">
            <circle cx="50" cy="50" r="38" stroke={accentColor} strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="44" stroke={accentColor} strokeWidth="0.5" strokeDasharray="6 2" opacity="0.4" />
          </g>
        )}

        {tier === "master-look" && (
          // Master grand wings / power flares behind the character
          <g>
            {/* Left wing */}
            <path
              d="M 38 60 C 20 50, 10 30, 24 20 C 32 15, 38 35, 42 50 Z"
              fill={accentColor}
              opacity="0.15"
            />
            <path
              d="M 38 60 C 20 50, 10 30, 24 20 C 32 15, 38 35, 42 50 Z"
              stroke={accentColor}
              strokeWidth="1.5"
              opacity="0.6"
            />
            {/* Right wing */}
            <path
              d="M 62 60 C 80 50, 90 30, 76 20 C 68 15, 62 35, 58 50 Z"
              fill={accentColor}
              opacity="0.15"
            />
            <path
              d="M 62 60 C 80 50, 90 30, 76 20 C 68 15, 62 35, 58 50 Z"
              stroke={accentColor}
              strokeWidth="1.5"
              opacity="0.6"
            />
          </g>
        )}

        {/* Layer 2: Base Body Layer (Consistent Silhouette) */}
        {/* Shadow */}
        <ellipse cx="50" cy="88" rx="22" ry="4" fill="black" opacity="0.25" />
        
        {/* Neck */}
        <path d="M 45 42 L 55 42 L 53 52 L 47 52 Z" fill="var(--bg-tertiary)" stroke="var(--border)" strokeWidth="1" />
        
        {/* Head */}
        <circle cx="50" cy="32" r="13" fill="var(--bg-tertiary)" stroke="var(--border)" strokeWidth="1.5" />
        
        {/* Torso Base */}
        <path
          d="M 32 78 C 32 58, 68 58, 68 78 C 68 82, 32 82, 32 78 Z"
          fill="var(--bg-tertiary)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />

        {/* Layer 3: Outfit Layer (Dominant Class Specific) */}
        {dominantClass === "warrior" && (
          // Warrior Armor Plate & Shoulder Guards
          <g>
            {/* Shoulder Guards */}
            <path d="M 28 58 C 24 58, 26 50, 36 50 Z" fill={accentColor} opacity="0.8" stroke="var(--border)" strokeWidth="1" />
            <path d="M 72 58 C 76 58, 74 50, 64 50 Z" fill={accentColor} opacity="0.8" stroke="var(--border)" strokeWidth="1" />
            {/* Breastplate Overlay */}
            <path
              d="M 38 56 L 62 56 L 58 74 L 50 82 L 42 74 Z"
              fill={accentColor}
              stroke="var(--border)"
              strokeWidth="1.5"
            />
            {/* Armor markings */}
            <path d="M 50 56 L 50 82" stroke="var(--border)" strokeWidth="1" opacity="0.5" />
            <path d="M 42 66 L 58 66" stroke="var(--border)" strokeWidth="1" opacity="0.5" />
          </g>
        )}

        {dominantClass === "mage" && (
          // Mage Robe Collars & Flowing Sleeves
          <g>
            {/* Robe Collar Left */}
            <path
              d="M 32 60 C 38 52, 48 56, 50 72 C 40 72, 34 68, 32 60 Z"
              fill={accentColor}
              stroke="var(--border)"
              strokeWidth="1"
            />
            {/* Robe Collar Right */}
            <path
              d="M 68 60 C 62 52, 52 56, 50 72 C 60 72, 66 68, 68 60 Z"
              fill={accentColor}
              stroke="var(--border)"
              strokeWidth="1"
            />
            {/* Center Gem on Collar */}
            <polygon points="50,62 52,65 50,68 48,65" fill="var(--accent-gold)" />
          </g>
        )}

        {dominantClass === "rogue" && (
          // Rogue Hood & Cowl Silhouette
          <g>
            {/* Hood overlay surrounding head */}
            <path
              d="M 34 32 C 34 16, 66 16, 66 32 C 66 42, 58 45, 50 45 C 42 45, 34 42, 34 32 Z"
              fill={accentColor}
              stroke="var(--border)"
              strokeWidth="1.5"
            />
            {/* Dark inner hood space */}
            <path
              d="M 39 32 C 39 21, 61 21, 61 32 C 61 38, 50 40, 50 40 C 50 40, 39 38, 39 32 Z"
              fill="var(--bg-secondary)"
            />
            {/* Wrapped cowl/scarf around shoulders */}
            <path
              d="M 32 54 C 40 50, 60 50, 68 54 L 62 66 L 38 66 Z"
              fill={accentColor}
              stroke="var(--border)"
              strokeWidth="1"
            />
          </g>
        )}

        {dominantClass === "balanced" && (
          // Balanced Hybrid Armor-Robe Combo
          <g>
            {/* Flowing cape behind shoulders */}
            <path d="M 30 78 L 22 82 L 24 88 L 36 84 Z" fill="var(--accent-purple)" opacity="0.6" stroke="var(--border)" strokeWidth="0.5" />
            <path d="M 70 78 L 78 82 L 76 88 L 64 84 Z" fill="var(--accent-purple)" opacity="0.6" stroke="var(--border)" strokeWidth="0.5" />
            {/* Hybrid Breastplate */}
            <path
              d="M 38 58 L 62 58 L 56 78 L 44 78 Z"
              fill="var(--accent-gold)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            {/* Sash/collar fold */}
            <path d="M 36 58 L 50 72 L 64 58" stroke="var(--accent-teal)" strokeWidth="2.5" fill="none" opacity="0.9" />
          </g>
        )}

        {/* Layer 4: Accessory Layer (Front / Detail Accents) */}
        {tier === "adept-look" && (
          // Adept glowing gem on forehead
          <polygon points="50,22 52,25 50,28 48,25" fill={accentColor} stroke="var(--border)" strokeWidth="0.5" />
        )}

        {tier === "master-look" && (
          // Master celestial halo hovering above the head
          <g>
            <ellipse cx="50" cy="14" rx="14" ry="3.5" stroke={accentColor} strokeWidth="2" fill="none" />
            {/* Glowing rays */}
            <line x1="50" y1="6" x2="50" y2="9" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="34" y1="11" x2="37" y2="13" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="66" y1="11" x2="63" y2="13" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        )}
      </svg>

      {/* Cosmetic Tier and Dominant Class Text Displays */}
      <div className="text-center mt-3 relative z-10">
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          {tierLabel}
        </p>
        <p
          className="text-xs font-extrabold mt-0.5 tracking-tight"
          style={{ color: accentColor }}
        >
          {classLabel}
        </p>
        <p className="text-[9px] text-slate-400 mt-1">
          {highestCount} completions
        </p>
      </div>
    </div>
  );
}
