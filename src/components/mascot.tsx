import React from "react";

/**
 * Cefi — the House Cefani mascot.
 *
 * Built on the same principle as Korbi over in korbern-app: object-as-
 * character, not a creature with a logo stuck on it. Korbern sells opened,
 * re-taped cartons, so its mascot is a carton. This app is the ledger of one
 * house — money in and out of it, whose turn it is to clean it, what the two
 * people living in it took this morning — so the mascot is the house.
 *
 * Drawing rules, inherited: chunky ink outlines, paper fill, and exactly one
 * accent colour. The orange is reserved for the brand devices and nothing
 * else — the roof, the door, and the round dot that also ends the wordmark.
 * Everything that isn't those three things is ink on paper, which is what
 * keeps a mascot from turning into clip art.
 *
 * The windows are the eyes and the door is the mouth, so the house reads as a
 * face at 20px in a sidebar without any of the detail surviving. Chimney smoke
 * is the ambient life sign: it drifts in every waking pose and stops when Cefi
 * sleeps.
 *
 * Rig contract with globals.css (origins in viewBox units):
 *   eyes 60,68 · arm-left 35,80 · arm-right 85,80 · smoke 75,12
 *   body breathe 60,104. Move a part, move its transform-origin too.
 */

export type MascotPose =
  | "default"
  | "waving"
  | "money" // holding a receipt slip — the ledger poses
  | "chores" // broom out
  | "grateful" // a spark off the chimney instead of smoke
  | "supplement" // capsule in hand
  | "sleeping" // closed shutters, no smoke, Zzz
  | "celebrating"; // arms up, confetti

type MascotProps = {
  pose?: MascotPose;
  className?: string;
  /** Rendered box in px. Omit to size via className/CSS. */
  size?: number;
  /** Freeze ambient animation (repeated marks, print, reduced motion). */
  still?: boolean;
  title?: string;
};

const INK = "#17161c";
const PAPER = "#fdfdfc";
const ACCENT = "#f24b1a";
const ACCENT_DEEP = "#d43a0d";
const SHADOW = "#dcdce2";
const MUTED = "#8b8890";
const STROKE = 2.6;

/* Parts --------------------------------------------------------------------- */

const Ground = () => (
  <ellipse cx="60" cy="108" rx="30" ry="3.6" fill={SHADOW} />
);

/** Pitched roof with overhanging eaves, plus the chimney it hangs off. */
const Roof = () => (
  <g>
    {/* Chimney is drawn first so the roof plane crosses its base — that
        overlap IS the flashing line. It has to clear the slope by a good
        margin or it reads as a torn flap rather than a chimney: the right
        slope passes y≈36 at x=78, so the stack starts at 16. */}
    <path
      d="M70 18 h10 a2.5 2.5 0 0 1 2.5 2.5 v20 h-15 v-20 a2.5 2.5 0 0 1 2.5 -2.5 z"
      fill={PAPER}
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
    {/* Cap, so the stack has a mouth for the smoke to leave from. */}
    <rect
      x="67.5"
      y="16"
      width="15"
      height="5"
      rx="2.5"
      fill={PAPER}
      stroke={INK}
      strokeWidth={STROKE}
    />
    <path
      d="M60 20 L92 48 H28 Z"
      fill={ACCENT}
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
    {/* Eave shadow — one darker step so the roof has a plane, not a flat fill. */}
    <path d="M60 20 L92 48 H74 Z" fill={ACCENT_DEEP} opacity="0.55" />
    <path
      d="M60 20 L92 48 H28 Z"
      fill="none"
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
    <rect x="24" y="46" width="72" height="7" rx="3.5" fill={PAPER} stroke={INK} strokeWidth={STROKE} />
  </g>
);

/** Front wall: the face lives here. */
const Wall = ({ children }: { children?: React.ReactNode }) => (
  <g>
    <rect
      x="34"
      y="52"
      width="52"
      height="52"
      rx="6"
      fill={PAPER}
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
    {children}
  </g>
);

/** Window-pane eyes. `shut` draws sleeping arcs instead of pupils. */
const Eyes = ({ shut = false, look = 0 }: { shut?: boolean; look?: number }) => (
  <g className="mascot-eyes">
    {[46, 66].map((x) => (
      <g key={x}>
        <rect
          x={x}
          y="62"
          width="14"
          height="14"
          rx="3"
          fill={PAPER}
          stroke={INK}
          strokeWidth={STROKE}
        />
        {shut ? (
          <path
            d={`M${x + 3.5} 69 q3.5 3.5 7 0`}
            fill="none"
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        ) : (
          <circle cx={x + 7 + look} cy="69.5" r="3" fill={INK} />
        )}
      </g>
    ))}
  </g>
);

/** The door is the mouth. Orange, with the brand dot for a handle. */
const Door = ({ open = false }: { open?: boolean }) => (
  <g>
    <path
      d="M52 104 v-14 a8 8 0 0 1 16 0 v14 z"
      fill={open ? INK : ACCENT}
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
    {!open && <circle cx="63.5" cy="97" r="1.8" fill={PAPER} />}
  </g>
);

/** Smoke: the ambient life sign. Three puffs rising off the chimney. */
const Smoke = ({ still }: { still?: boolean }) => (
  <g className={still ? undefined : "mascot-smoke"} opacity="0.75">
    <circle cx="75" cy="11" r="3.2" fill={MUTED} />
    <circle cx="79.5" cy="5.5" r="2.4" fill={MUTED} opacity="0.7" />
    <circle cx="74.5" cy="1" r="1.8" fill={MUTED} opacity="0.45" />
  </g>
);

const Arm = ({
  side,
  d,
  className,
}: {
  side: "left" | "right";
  d: string;
  className?: string;
}) => (
  <g className={className} data-side={side}>
    <path
      d={d}
      fill="none"
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinecap="round"
    />
  </g>
);

const Glove = ({ x, y }: { x: number; y: number }) => (
  <circle cx={x} cy={y} r="4.4" fill={PAPER} stroke={INK} strokeWidth={STROKE} />
);

/* Poses --------------------------------------------------------------------- */

function PoseProps({ pose, still }: { pose: MascotPose; still?: boolean }) {
  switch (pose) {
    case "waving":
      return (
        <g>
          <Arm side="right" d="M85 78 L90 73" className={still ? undefined : "mascot-wave"} />
          <g className={still ? undefined : "mascot-wave"}>
            <Glove x={91.5} y={71.5} />
          </g>
          <Arm side="left" d="M35 81 L30 86" />
          <Glove x={28.5} y={87.5} />
        </g>
      );

    case "money":
      return (
        <g>
          <Arm side="right" d="M85 82 L89.5 84" />
          {/* Receipt slip with a torn bottom edge — the ledger, in hand. */}
          <path
            d="M90 70 h15 v20 l-3 -2.5 l-3 2.5 l-3 -2.5 l-2.5 2.5 l-3.5 -2.5 z"
            fill={PAPER}
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          <path d="M94 76 h8 M94 81 h5" stroke={MUTED} strokeWidth="2" strokeLinecap="round" />
          <Glove x={91} y={85} />
          <Arm side="left" d="M35 81 L30 86" />
          <Glove x={28.5} y={87.5} />
        </g>
      );

    case "chores":
      return (
        <g>
          <Arm side="right" d="M85 80 L90 79" />
          {/* Broom: handle up, bristle block down, one accent band. */}
          <path d="M97 60 L93 92" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
          <path
            d="M89 92 h9 l3 12 h-15 z"
            fill={ACCENT}
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          <path d="M88 98 h14" stroke={INK} strokeWidth="1.8" />
          <Glove x={91.5} y={78.5} />
          <Arm side="left" d="M35 81 L30 86" />
          <Glove x={28.5} y={87.5} />
        </g>
      );

    case "supplement":
      return (
        <g>
          <Arm side="right" d="M85 80 L90 78" />
          {/* Capsule, half accent half paper — the supplements tracker. */}
          <g transform="rotate(-28 97 70)">
            <rect x="89" y="65" width="16" height="10" rx="5" fill={PAPER} stroke={INK} strokeWidth={STROKE} />
            <path
              d="M94 65 h-0.2 a5 5 0 0 0 0 10 h0.2 z"
              fill={ACCENT}
              stroke={INK}
              strokeWidth={STROKE}
              strokeLinejoin="round"
            />
          </g>
          <Glove x={91.5} y={77.5} />
          <Arm side="left" d="M35 81 L30 86" />
          <Glove x={28.5} y={87.5} />
        </g>
      );

    case "celebrating":
      return (
        <g>
          <Arm side="right" d="M85 78 L91 70" />
          <Glove x={92.5} y={68} />
          <Arm side="left" d="M35 78 L29 70" />
          <Glove x={27.5} y={68} />
          <g className={still ? undefined : "mascot-confetti"}>
            <rect x="18" y="46" width="4" height="4" rx="1" fill={ACCENT} transform="rotate(22 20 48)" />
            <rect x="98" y="50" width="4" height="4" rx="1" fill={INK} transform="rotate(-16 100 52)" />
            <circle cx="14" cy="60" r="2.2" fill={ACCENT} />
            <circle cx="106" cy="40" r="2.2" fill={ACCENT} />
          </g>
        </g>
      );

    case "grateful":
      return (
        <g>
          <Arm side="right" d="M85 81 L90 85" />
          <Glove x={91.5} y={86.5} />
          <Arm side="left" d="M35 81 L30 85" />
          <Glove x={28.5} y={86.5} />
        </g>
      );

    default:
      return (
        <g>
          <Arm side="right" d="M85 81 L90 86" />
          <Glove x={91.5} y={87.5} />
          <Arm side="left" d="M35 81 L30 86" />
          <Glove x={28.5} y={87.5} />
        </g>
      );
  }
}

/** The four-point spark that also marks the Gratitude section. */
const Spark = () => (
  <path
    d="M75 -5 C76 3 78 5 86 6 C78 7 76 9 75 17 C74 9 72 7 64 6 C72 5 74 3 75 -5 Z"
    fill={ACCENT}
    stroke={INK}
    strokeWidth="1.6"
    strokeLinejoin="round"
  />
);

const Zzz = () => (
  <g fill={MUTED} fontFamily="var(--font-display), sans-serif" fontWeight="700">
    <text x="94" y="26" fontSize="12">z</text>
    <text x="102" y="16" fontSize="9">z</text>
    <text x="108" y="8" fontSize="7">z</text>
  </g>
);

/* Component ----------------------------------------------------------------- */

export function Mascot({
  pose = "default",
  className,
  size,
  still = false,
  title,
}: MascotProps) {
  const asleep = pose === "sleeping";
  const label = title ?? `Cefi, the House Cefani mascot — ${pose}`;

  return (
    <svg
      viewBox="-4 -8 128 128"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <Ground />
      {asleep ? <Zzz /> : pose === "grateful" ? <Spark /> : <Smoke still={still} />}
      <g className={still || asleep ? undefined : "mascot-breathe"}>
        <PoseProps pose={pose} still={still} />
        <Roof />
        <Wall>
          <Eyes shut={asleep} look={pose === "money" ? 2 : 0} />
          <Door open={pose === "celebrating"} />
        </Wall>
      </g>
    </svg>
  );
}

/**
 * The bare mark — roof + wall + door, no face, no limbs. For favicons, the
 * sidebar wordmark and anywhere the full character would be noise.
 */
export function MascotMark({
  className,
  size,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="20 18 80 88"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="House Cefani"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M60 24 L94 54 H26 Z"
        fill={ACCENT}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="36"
        y="54"
        width="48"
        height="46"
        rx="6"
        fill={PAPER}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="46" y="64" width="12" height="12" rx="3" fill={INK} />
      <rect x="64" y="64" width="12" height="12" rx="3" fill={INK} />
      <path
        d="M52 100 v-12 a8 8 0 0 1 16 0 v12 z"
        fill={ACCENT}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
