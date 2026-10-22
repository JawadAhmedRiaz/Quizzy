import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface AvatarOption {
  id: string;
  name: string;
  title: string;
  accent: string;
  tag: string;
}

export const AVATAR_LIST: AvatarOption[] = [
  { id: "cyber-ninja", name: "Cyber Shadow", title: "Cybersecurity Operative", accent: "#007AFF", tag: "Tech" },
  { id: "astro-pioneer", name: "Star Voyager", title: "Cosmic Explorer", accent: "#8B5CF6", tag: "Cosmic" },
  { id: "quantum-bot", name: "Nova AI", title: "Neural Matrix Unit", accent: "#10B981", tag: "AI Bot" },
  { id: "code-wizard", name: "Grand Mage", title: "Master of Algorithms", accent: "#F59E0B", tag: "Magic" },
  { id: "scholar-owl", name: "Professor Hoot", title: "Dean of Knowledge", accent: "#EC4899", tag: "Scholar" },
  { id: "flame-phoenix", name: "Solar Phoenix", title: "Unstoppable Learner", accent: "#EF4444", tag: "Fire" },
];

export function getSavedAvatarId(): string {
  if (typeof window === "undefined") return "cyber-ninja";
  return localStorage.getItem("quizzy_avatar_id") || "cyber-ninja";
}

export function saveAvatarId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("quizzy_avatar_id", id);
}

// ─── SVG CHARACTER RENDERERS WITH EMBEDDED ANIMATIONS ───

function CyberNinjaSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cn-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B132B" />
          <stop offset="1" stopColor="#1C2541" />
        </linearGradient>
        <linearGradient id="cn-visor" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5FF" />
          <stop offset="0.5" stopColor="#007AFF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <radialGradient id="cn-glow" cx="50" cy="50" r="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5FF" stopOpacity="0.4" />
          <stop offset="1" stopColor="#00E5FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer ambient glow */}
      <circle cx="50" cy="50" r="46" fill="url(#cn-glow)" className="animate-pulse" />
      {/* Base circle frame */}
      <circle cx="50" cy="50" r="44" fill="url(#cn-bg)" stroke="#007AFF" strokeWidth="2.5" />
      
      {/* Hood / Ninja cowl */}
      <path d="M 24 64 C 22 40, 32 20, 50 18 C 68 20, 78 40, 76 64 C 74 78, 66 84, 50 84 C 34 84, 26 78, 24 64 Z" fill="#111827" />
      <path d="M 28 62 C 26 44, 34 26, 50 24 C 66 26, 74 44, 72 62 C 70 74, 64 78, 50 78 C 36 78, 30 74, 28 62 Z" fill="#1F2937" />
      
      {/* Headband with glowing kanji/insignia */}
      <path d="M 29 38 Q 50 35 71 38 L 70 45 Q 50 42 30 45 Z" fill="#007AFF" />
      <circle cx="50" cy="41" r="2.5" fill="#FFFFFF" className="animate-ping" style={{ animationDuration: "3s" }} />

      {/* Visor Area */}
      <rect x="32" y="47" width="36" height="12" rx="4" fill="#030712" stroke="#00E5FF" strokeWidth="1.5" />
      <rect x="34" y="49" width="32" height="8" rx="2" fill="url(#cn-visor)" />

      {/* Cyber Eyes / Scanline */}
      <line x1="36" y1="53" x2="64" y2="53" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <animate attributeName="x1" values="36; 48; 36" dur="2s" repeatCount="indefinite" />
        <animate attributeName="x2" values="64; 52; 64" dur="2s" repeatCount="indefinite" />
      </line>

      {/* Mask Lower vents */}
      <line x1="42" y1="67" x2="58" y2="67" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="45" y1="71" x2="55" y2="71" stroke="#00E5FF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function AstroPioneerSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ap-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E1B4B" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
        <linearGradient id="ap-gold" x1="30" y1="35" x2="70" y2="65" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="0.5" stopColor="#FDE047" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      {/* Background with stars */}
      <circle cx="50" cy="50" r="44" fill="url(#ap-bg)" stroke="#818CF8" strokeWidth="2.5" />
      <circle cx="28" cy="30" r="1.5" fill="#FFFFFF" opacity="0.8" className="animate-pulse" />
      <circle cx="72" cy="28" r="1.2" fill="#FDE047" opacity="0.9" />
      <circle cx="75" cy="65" r="1.5" fill="#FFFFFF" opacity="0.7" className="animate-pulse" />
      <circle cx="24" cy="60" r="1" fill="#A5B4FC" opacity="0.6" />

      {/* Astronaut Suit Collar */}
      <path d="M 26 80 C 30 70, 70 70, 74 80 L 70 88 L 30 88 Z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
      <rect x="42" y="77" width="16" height="6" rx="2" fill="#4338CA" />

      {/* Helmet Shell */}
      <circle cx="50" cy="48" r="26" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
      
      {/* Visor */}
      <ellipse cx="50" cy="48" rx="19" ry="15" fill="#0F172A" stroke="#818CF8" strokeWidth="1.5" />
      <ellipse cx="50" cy="48" rx="17" ry="13" fill="url(#ap-gold)" opacity="0.9" />
      
      {/* Visor Glare / Reflection animation */}
      <path d="M 37 42 Q 46 38 56 42" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
        <animate attributeName="opacity" values="0.85; 0.3; 0.85" dur="3s" repeatCount="indefinite" />
      </path>
      <circle cx="40" cy="48" r="2" fill="#FFFFFF" opacity="0.75" />
      
      {/* Side Communications Antenna */}
      <line x1="74" y1="45" x2="82" y2="35" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="82" cy="35" r="2.5" fill="#EF4444" className="animate-ping" style={{ animationDuration: "2s" }} />
    </svg>
  );
}

function QuantumBotSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="qb-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#064E3B" />
          <stop offset="1" stopColor="#022C22" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="url(#qb-bg)" stroke="#10B981" strokeWidth="2.5" />
      
      {/* Antenna */}
      <line x1="50" y1="26" x2="50" y2="18" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="16" r="3.5" fill="#34D399" className="animate-pulse" />

      {/* Robot Head */}
      <rect x="28" y="28" width="44" height="40" rx="10" fill="#1F2937" stroke="#374151" strokeWidth="2" />
      
      {/* Screen Frame */}
      <rect x="33" y="34" width="34" height="26" rx="6" fill="#030712" stroke="#059669" strokeWidth="1.5" />
      
      {/* Pixel/LED Eyes */}
      <rect x="38" y="40" width="8" height="6" rx="2" fill="#10B981">
        <animate attributeName="height" values="6; 1; 6" dur="3.5s" repeatCount="indefinite" />
        <animate attributeName="y" values="40; 43; 40" dur="3.5s" repeatCount="indefinite" />
      </rect>
      <rect x="54" y="40" width="8" height="6" rx="2" fill="#10B981">
        <animate attributeName="height" values="6; 1; 6" dur="3.5s" repeatCount="indefinite" />
        <animate attributeName="y" values="40; 43; 40" dur="3.5s" repeatCount="indefinite" />
      </rect>
      
      {/* LED Smile */}
      <path d="M 43 52 Q 50 56 57 52" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />

      {/* Body / Neck bolts */}
      <rect x="42" y="69" width="16" height="8" rx="2" fill="#4B5563" />
      <circle cx="30" cy="74" r="2" fill="#10B981" />
      <circle cx="70" cy="74" r="2" fill="#10B981" />
      <path d="M 32 80 C 36 74, 64 74, 68 80 L 66 88 L 34 88 Z" fill="#374151" />
    </svg>
  );
}

function CodeWizardSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cw-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#311042" />
          <stop offset="1" stopColor="#1E0A2A" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="url(#cw-bg)" stroke="#F59E0B" strokeWidth="2.5" />
      
      {/* Face */}
      <circle cx="50" cy="52" r="16" fill="#FDE68A" />
      <circle cx="44" cy="50" r="2" fill="#1E1B4B" />
      <circle cx="56" cy="50" r="2" fill="#1E1B4B" />
      
      {/* Wizard Beard */}
      <path d="M 40 56 C 40 68, 50 76, 50 76 C 50 76, 60 68, 60 56 Z" fill="#F8FAFC" />
      
      {/* Pointy Hat */}
      <path d="M 26 40 L 50 14 L 74 40 Z" fill="#6D28D9" stroke="#8B5CF6" strokeWidth="1.5" />
      {/* Hat Brim */}
      <ellipse cx="50" cy="40" rx="30" ry="6" fill="#4C1D95" stroke="#A78BFA" strokeWidth="1.5" />
      
      {/* Magic Star on Hat */}
      <polygon points="50,22 52,26 56,26 53,28 54,32 50,30 46,32 47,28 44,26 48,26" fill="#F59E0B">
        <animate attributeName="opacity" values="1; 0.4; 1" dur="2s" repeatCount="indefinite" />
      </polygon>
      
      {/* Magic Runes / Particles */}
      <circle cx="28" cy="62" r="2" fill="#F59E0B" className="animate-ping" style={{ animationDuration: "2.5s" }} />
      <circle cx="72" cy="58" r="1.5" fill="#38BDF8" className="animate-pulse" />
      <text x="50" y="86" textAnchor="middle" fill="#F59E0B" fontSize="9" fontWeight="bold" fontFamily="monospace">&lt;/&gt;</text>
    </svg>
  );
}

function ScholarOwlSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="so-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#831843" />
          <stop offset="1" stopColor="#500724" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="url(#so-bg)" stroke="#EC4899" strokeWidth="2.5" />
      
      {/* Graduation Cap */}
      <polygon points="50,18 78,28 50,38 22,28" fill="#18181B" stroke="#3F3F46" strokeWidth="1" />
      <rect x="36" y="32" width="28" height="6" fill="#27272A" />
      {/* Tassel */}
      <line x1="50" y1="28" x2="72" y2="34" stroke="#F59E0B" strokeWidth="1.5" />
      <circle cx="72" cy="35" r="2" fill="#F59E0B" />
      
      {/* Owl Body */}
      <ellipse cx="50" cy="58" rx="22" ry="20" fill="#78350F" />
      <ellipse cx="50" cy="62" rx="14" ry="14" fill="#FEF3C7" />
      
      {/* Big Owl Eyes */}
      <circle cx="41" cy="50" r="9" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />
      <circle cx="59" cy="50" r="9" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />
      <circle cx="41" cy="50" r="4.5" fill="#1C1917">
        <animate attributeName="r" values="4.5; 1.5; 4.5" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="59" cy="50" r="4.5" fill="#1C1917">
        <animate attributeName="r" values="4.5; 1.5; 4.5" dur="4s" repeatCount="indefinite" />
      </circle>
      
      {/* Glasses Frame */}
      <circle cx="41" cy="50" r="10" fill="none" stroke="#EC4899" strokeWidth="1.8" />
      <circle cx="59" cy="50" r="10" fill="none" stroke="#EC4899" strokeWidth="1.8" />
      <line x1="51" y1="50" x2="49" y2="50" stroke="#EC4899" strokeWidth="2" />
      
      {/* Beak */}
      <polygon points="50,56 46,62 54,62" fill="#F59E0B" />
    </svg>
  );
}

function FlamePhoenixSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fp-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7F1D1D" />
          <stop offset="1" stopColor="#450A0A" />
        </linearGradient>
        <linearGradient id="fp-fire" x1="50" y1="20" x2="50" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="0.5" stopColor="#F97316" />
          <stop offset="1" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="url(#fp-bg)" stroke="#EF4444" strokeWidth="2.5" />
      
      {/* Fire Wings / Crest */}
      <path d="M 50 18 Q 30 36 28 62 Q 40 50 50 56 Q 60 50 72 62 Q 70 36 50 18 Z" fill="url(#fp-fire)" />
      
      {/* Core Bird Head */}
      <circle cx="50" cy="46" r="12" fill="#FEF08A" />
      <polygon points="50,48 60,51 50,54" fill="#B91C1C" />
      <circle cx="47" cy="44" r="2.5" fill="#7F1D1D" />
      
      {/* Rising Embers */}
      <circle cx="35" cy="28" r="1.5" fill="#FDE047" className="animate-ping" style={{ animationDuration: "1.8s" }} />
      <circle cx="65" cy="24" r="2" fill="#F97316" className="animate-pulse" />
      <circle cx="50" cy="80" r="2" fill="#FDE047" className="animate-bounce" />
    </svg>
  );
}

export function renderAvatarSvg(id: string, size = 64) {
  switch (id) {
    case "astro-pioneer":
      return <AstroPioneerSvg size={size} />;
    case "quantum-bot":
      return <QuantumBotSvg size={size} />;
    case "code-wizard":
      return <CodeWizardSvg size={size} />;
    case "scholar-owl":
      return <ScholarOwlSvg size={size} />;
    case "flame-phoenix":
      return <FlamePhoenixSvg size={size} />;
    case "cyber-ninja":
    default:
      return <CyberNinjaSvg size={size} />;
  }
}

// ─── MAIN ANIMATED AVATAR COMPONENT ───

interface Props {
  avatarId?: string;
  size?: number;
  interactive?: boolean;
  onSelectAvatar?: (id: string) => void;
  className?: string;
}

export function AnimatedAvatar({
  avatarId,
  size = 64,
  interactive = true,
  onSelectAvatar,
  className = "",
}: Props) {
  const [currentId, setCurrentId] = useState(() => avatarId || getSavedAvatarId());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (avatarId) setCurrentId(avatarId);
  }, [avatarId]);

  function handlePick(id: string) {
    setCurrentId(id);
    saveAvatarId(id);
    if (onSelectAvatar) onSelectAvatar(id);
    setModalOpen(false);
  }

  const selectedMeta = AVATAR_LIST.find((a) => a.id === currentId) || AVATAR_LIST[0];

  return (
    <>
      <div
        className={`relative inline-flex items-center justify-center cursor-pointer select-none group ${className}`}
        style={{ width: size, height: size }}
        onClick={() => interactive && setModalOpen(true)}
        title={interactive ? `Click to customize your Animated Avatar (${selectedMeta.name})` : selectedMeta.name}
      >
        {/* Animated breathing glow container */}
        <motion.div
          animate={{
            scale: [1, 1.03, 1],
            filter: [
              `drop-shadow(0 0 8px ${selectedMeta.accent}40)`,
              `drop-shadow(0 0 16px ${selectedMeta.accent}70)`,
              `drop-shadow(0 0 8px ${selectedMeta.accent}40)`,
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full flex items-center justify-center"
        >
          {renderAvatarSvg(currentId, size)}
        </motion.div>

        {/* Edit Pill Indicator on Hover */}
        {interactive && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] shadow-lg border-2 border-white dark:border-slate-900 opacity-90 group-hover:scale-110 transition-transform">
            ✏️
          </div>
        )}
      </div>

      {/* ─── AVATAR SELECTOR MODAL ─── */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl z-10"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div>
                  <h3 className="text-lg font-black" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Choose Your Animated Avatar
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your avatar represents you on the Dashboard and Leaderboard!
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Grid of Avatars */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                {AVATAR_LIST.map((av) => {
                  const isSelected = av.id === currentId;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handlePick(av.id)}
                      className="flex flex-col items-center text-center p-3 rounded-xl transition-all relative group"
                      style={{
                        background: isSelected ? "rgba(0, 122, 255, 0.12)" : "hsl(var(--muted)/0.4)",
                        border: isSelected ? `2px solid ${av.accent}` : "1px solid hsl(var(--border))",
                        boxShadow: isSelected ? `0 0 16px ${av.accent}40` : "none",
                      }}
                    >
                      <div className="w-16 h-16 flex items-center justify-center mb-2 transform group-hover:scale-105 transition-transform">
                        {renderAvatarSvg(av.id, 60)}
                      </div>
                      <span className="text-xs font-bold leading-tight">{av.name}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{av.tag}</span>

                      {isSelected && (
                        <div
                          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                          style={{ background: av.accent }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
