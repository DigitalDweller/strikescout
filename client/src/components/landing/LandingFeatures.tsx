import { motion, useReducedMotion } from "framer-motion";
import { Activity, BarChart3, ClipboardList, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureDef = {
  title: string;
  description: string;
  icon: LucideIcon;
  visualImageSrc?: string;
  visualImageAlt?: string;
};

/** Odd index (0,2): text left / image right. Even index (1,3): image left / text right. */
const FEATURES: FeatureDef[] = [
  {
    title: "Match Scouting",
    description:
      "Capture data quickly during matches with streamlined forms built for phones and tablets—large touch targets, clear sections, and fewer mistakes in the stands.",
    icon: ClipboardList,
    visualImageSrc: "/feature-match-scouting.png",
    visualImageAlt:
      "Teleop scouting form with throughput segments, accuracy and evasion effectiveness sliders, and defense toggles on a dark UI",
  },
  {
    title: "Team Analytics",
    description:
      "Compare teams, view rankings, and make data-driven picks. Scout notes, performance cards, and color-coded stats stay consistent with the rest of your workflow.",
    icon: BarChart3,
    visualImageSrc: "/feature-team-analytics.png",
    visualImageAlt:
      "Strikescout team profile showing scout notes, performance metrics, and rankings with color-coded stats",
  },
  {
    title: "Picklists",
    description:
      "Build and share alliance selection lists with your drive team so everyone sees the same ordered targets before you head to the field.",
    icon: Target,
    visualImageSrc: "/feature-picklists.png",
    visualImageAlt:
      "Picklists view with available teams on the left and a ranked picklist on the right, drag handles and color-coded team cards",
  },
  {
    title: "Team Heatmaps",
    description:
      "See where shots cluster on the field with aggregate shooting heatmaps—spot patterns at a glance and back up gut feelings with spatial data.",
    icon: Activity,
    visualImageSrc: "/feature-team-heatmaps.png",
    visualImageAlt:
      "Shooting heatmap overlaid on the competition field showing frequency of shot locations from green through yellow to red",
  },
];

function FeatureImagePanel({
  feature,
  imageOnRight,
}: {
  feature: FeatureDef;
  /** When true, image sits in the right column (fade from left). When false, left column (fade from right). */
  imageOnRight: boolean;
}) {
  const fadeOverlay = imageOnRight
    ? "bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent"
    : "bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent";

  return (
    <div className="relative h-full min-h-[280px] w-full overflow-hidden sm:min-h-[360px] lg:min-h-0">
      {feature.visualImageSrc ? (
        <img
          src={feature.visualImageSrc}
          alt={feature.visualImageAlt ?? ""}
          className="absolute inset-0 h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 70% 40%, rgba(59, 130, 246, 0.12), transparent 55%),
              linear-gradient(180deg, rgba(24, 24, 27, 0.9) 0%, rgb(9 9 11) 100%)
            `,
          }}
          aria-hidden
        >
          <div
            className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
          />
          <span className="relative text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">
            Preview
          </span>
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 z-10 hidden w-[62%] lg:block xl:w-[58%]",
          imageOnRight ? "left-0" : "right-0",
          fadeOverlay,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 z-[11] hidden w-[32%] opacity-95 lg:block lg:w-[28%]",
          imageOnRight ? "left-0" : "right-0",
        )}
        style={{
          background: imageOnRight
            ? "linear-gradient(to right, rgb(9 9 11) 0%, transparent 100%)"
            : "linear-gradient(to left, rgb(9 9 11) 0%, transparent 100%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-zinc-950 to-transparent lg:hidden"
        aria-hidden
      />
    </div>
  );
}

function FeatureRow({
  feature,
  index,
  showDivider,
}: {
  feature: FeatureDef;
  index: number;
  showDivider: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const Icon = feature.icon;
  const imageOnRight = index % 2 === 0;

  return (
    <motion.section
      className={cn(
        "relative w-full overflow-hidden bg-zinc-950",
        showDivider && "border-b border-zinc-800/50",
      )}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative min-h-0 lg:grid lg:min-h-[min(32rem,70vh)] lg:grid-cols-2 lg:items-stretch">
        <div
          className={cn(
            "relative z-20 flex flex-col justify-center px-6 py-16 sm:px-10 sm:py-20 lg:py-32 lg:pl-12 lg:pr-10 xl:px-24",
            imageOnRight ? "lg:order-1" : "lg:order-2",
          )}
        >
          <div
            className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500"
            aria-hidden
          >
            <Icon className="h-7 w-7" strokeWidth={2} />
          </div>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {feature.title}
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-300 sm:text-lg">
            {feature.description}
          </p>
        </div>

        <div
          className={cn(
            "relative min-h-[280px] w-full sm:min-h-[360px] lg:min-h-0",
            imageOnRight ? "lg:order-2" : "lg:order-1",
          )}
        >
          <div className="relative h-full w-full lg:absolute lg:inset-0">
            <FeatureImagePanel feature={feature} imageOnRight={imageOnRight} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** Edge-to-edge feature rows: 50/50 split, imagery bleeds and fades into zinc-950 text columns */
export function LandingFeatures() {
  return (
    <div className="relative z-10 border-t border-zinc-800/80 bg-zinc-950">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:px-10 lg:px-12 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-500">Inside the app</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
          Everything your scouting crew needs
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Purpose-built workflows so your students spend less time tapping and more time watching instead.
        </p>
      </div>

      {FEATURES.map((feature, index) => (
        <FeatureRow
          key={feature.title}
          feature={feature}
          index={index}
          showDivider={index < FEATURES.length - 1}
        />
      ))}
    </div>
  );
}
