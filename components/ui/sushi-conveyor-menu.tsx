"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export type DishTier = 1 | 2 | 3 | 4 | 5;

export interface ConveyorDish {
  id: string;
  /** Accessible name, chip text and dialog title. */
  name: string;
  /** One or two sentences for the caption and the dialog. */
  description?: string;
  /** Price text such as "₹29,999", shown on the chip and the dialog. */
  price: string;
  /** Price tier 1–5. */
  tier?: DishTier;
  /** Top-down photo of the plate, centred on a transparent square canvas. */
  image: string;
  /** Short facts/deliverables listed as chips in the dialog. */
  details?: string[];
}

export interface SushiConveyorMenuLabels {
  add: string;
  close: string;
  previous: string;
  next: string;
  pause?: string;
}

export interface SushiConveyorMenuProps extends React.ComponentProps<"section"> {
  items: ConveyorDish[];
  eyebrow?: string;
  heading?: string;
  caption?: string;
  action?: React.ReactNode;
  speed?: number;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  autoplay?: boolean;
  interval?: number;
  active?: number | null;
  onActiveChange?: (index: number | null) => void;
  onOpenChange?: (index: number | null) => void;
  onAdd?: (item: ConveyorDish) => void;
  legend?: { [tier: number]: string };
  labels?: SushiConveyorMenuLabels;
}

const SPACING = 1.35;
const CURVE = 0.98;
const BAND = 1.22;
const TILT = 0.8;
const SLAT = 0.34;
const LIFT_Y = -6;
const LIFT_SCALE = 0.08;
const BACK_SHADE = 0.15;
const CHIP_ROOM = 34;
const WIDE = 1024;
const RUN = 0;

const DEFAULT_LABELS: SushiConveyorMenuLabels = {
  add: "Add to cart",
  close: "Close",
  previous: "Previous plate",
  next: "Next plate",
  pause: "Pause belt",
};

const TIERS = [
  { ring: "border-chart-1", dot: "bg-chart-1" },
  { ring: "border-chart-2", dot: "bg-chart-2" },
  { ring: "border-chart-3", dot: "bg-chart-3" },
  { ring: "border-chart-4", dot: "bg-chart-4" },
  { ring: "border-chart-5", dot: "bg-chart-5" },
] as const;

const THEME =
  "[--belt:color-mix(in_oklab,var(--color-foreground)_78%,var(--color-background))] " +
  "[--belt-side:color-mix(in_oklab,var(--color-foreground)_92%,var(--color-background))] " +
  "[--rail:color-mix(in_oklab,var(--color-muted-foreground)_45%,white)] " +
  "[--island:color-mix(in_oklab,var(--color-muted-foreground)_16%,var(--color-background))] " +
  "[--island-low:color-mix(in_oklab,var(--color-muted-foreground)_27%,var(--color-background))] " +
  "[--island-wall:color-mix(in_oklab,var(--color-muted-foreground)_42%,var(--color-background))]";

type Geo = {
  width: number; height: number; d: number; r: number; s: number; l: number; pitch: number; n: number;
  kb: number; cx: number; ym: number; a: number; b: number; band: number; slats: number; side: number; edgeTop: number;
};
type Point = { x: number; z: number; nx: number; nz: number; tx: number; tz: number };
type Sim = {
  offset: number; v: number; mode: number; target: number;
  lift: number[]; vlift: number[]; z: number[]; lane: string[];
  raf: number; last: number; visible: boolean; init: boolean; l: number;
};

function makeSim(): Sim {
  return {
    offset: 0,
    v: 0,
    mode: RUN,
    target: 0,
    lift: [],
    vlift: [],
    z: [],
    lane: [],
    raf: 0,
    last: 0,
    visible: true,
    init: false,
    l: 0,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tierStyle(tier: number | undefined) {
  return TIERS[clamp(Math.round(tier ?? 1), 1, 5) - 1] ?? TIERS[0];
}

function along(g: Geo, u: number): Point {
  const { s, r } = g;
  let t = ((u % g.l) + g.l) % g.l;
  if (t < s) return { x: s / 2 - t, z: r, nx: 0, nz: 1, tx: -1, tz: 0 };
  t -= s;
  const arc = Math.PI * r;
  if (t < arc) {
    const f = t / r;
    const sin = Math.sin(f);
    const cos = Math.cos(f);
    return { x: -s / 2 - r * sin, z: r * cos, nx: -sin, nz: cos, tx: -cos, tz: -sin };
  }
  t -= arc;
  if (t < s) return { x: -s / 2 + t, z: -r, nx: 0, nz: -1, tx: 1, tz: 0 };
  t -= s;
  const f = Math.min(Math.PI, t / r);
  const sin = Math.sin(f);
  const cos = Math.cos(f);
  return { x: s / 2 + r * sin, z: -r * cos, nx: sin, nz: -cos, tx: cos, tz: sin };
}

function project(g: Geo, x: number, z: number) {
  const k = g.a + g.b * z;
  return { x: g.cx + x * k, y: g.ym + TILT * (g.a * z + (g.b * z * z) / 2), k };
}

function makeGeo(width: number, n: number, d: number, kb: number): Geo {
  const l = Math.max(1, n) * SPACING * d;
  const r = Math.min(CURVE * d, l / (2 * Math.PI));
  const s = Math.max(0, (l - 2 * Math.PI * r) / 2);
  const g: Geo = {
    width,
    height: 0,
    d,
    r,
    s,
    l,
    pitch: l / Math.max(1, n),
    n: Math.max(1, n),
    kb,
    cx: width / 2,
    ym: 0,
    a: (1 + kb) / 2,
    b: (1 - kb) / (2 * r),
    band: BAND * d,
    slats: Math.max(10, Math.round(l / (SLAT * d))),
    side: Math.max(4, d * 0.07),
    edgeTop: 0,
  };
  let top = Infinity;
  let bottom = -Infinity;
  let edge = Infinity;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    const half = (plate.k * d * TILT) / 2;
    edge = Math.min(edge, rim.y);
    top = Math.min(top, rim.y, plate.y + (LIFT_Y / 100) * half * 2 - half * (1 + LIFT_SCALE) - CHIP_ROOM);
    bottom = Math.max(bottom, rim.y + g.side + d * 0.06, plate.y + half + d * 0.08);
  }
  g.ym = Math.ceil(-top) + 4;
  g.height = Math.ceil(bottom - top) + 8;
  g.edgeTop = edge + g.ym;
  return g;
}

function halfSpan(g: Geo) {
  let span = 0;
  for (let j = 0; j < 120; j++) {
    const p = along(g, (j / 120) * g.l);
    const rim = project(g, p.x + (p.nx * g.band) / 2, p.z + (p.nz * g.band) / 2);
    const plate = project(g, p.x, p.z);
    span = Math.max(
      span,
      Math.abs(rim.x - g.cx) + 3,
      Math.abs(plate.x - g.cx) + (plate.k * g.d * (1 + LIFT_SCALE)) / 2
    );
  }
  return span;
}

function edgePath(g: Geo, offset: number) {
  let d = "";
  const steps = 168;
  for (let j = 0; j < steps; j++) {
    const p = along(g, (j / steps) * g.l);
    const q = project(g, p.x + p.nx * offset, p.z + p.nz * offset);
    d += `${j ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  return `${d}Z`;
}

function slatPath(g: Geo, offset: number, shift: number) {
  const half = g.band * 0.46;
  const pitch = g.l / g.slats;
  const bulge = pitch * 0.2;
  let d = "";
  for (let j = 0; j < g.slats; j++) {
    const p = along(g, offset + shift + j * pitch);
    const inner = project(g, p.x - p.nx * half, p.z - p.nz * half);
    const outer = project(g, p.x + p.nx * half, p.z + p.nz * half);
    const mid = project(g, p.x + p.tx * bulge, p.z + p.tz * bulge);
    d += `M${inner.x.toFixed(1)} ${inner.y.toFixed(1)}Q${(2 * mid.x - (inner.x + outer.x) / 2).toFixed(1)} ${(2 * mid.y - (inner.y + outer.y) / 2).toFixed(1)} ${outer.x.toFixed(1)} ${outer.y.toFixed(1)}`;
  }
  return d;
}

function pose(g: Geo, offset: number, i: number) {
  const p = along(g, offset - i * g.pitch);
  const q = project(g, p.x, p.z);
  return { x: q.x, y: q.y, k: q.k, depth: (p.z + g.r) / (2 * g.r) };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function SushiConveyorMenu({
  items,
  heading,
  speed = 38,
  onAdd,
  onOpenChange,
  labels = DEFAULT_LABELS,
  className,
  ref,
  ...rest
}: SushiConveyorMenuProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const count = items.length;
  const sectionRef = React.useRef(null as HTMLElement | null);
  const stageRef = React.useRef(null as HTMLDivElement | null);
  const beltRef = React.useRef(null as HTMLDivElement | null);
  const seamRef = React.useRef(null as SVGPathElement | null);
  const glintRef = React.useRef(null as SVGPathElement | null);
  const plates = React.useRef([] as (HTMLButtonElement | null)[]);
  const lifts = React.useRef([] as (HTMLSpanElement | null)[]);
  const shades = React.useRef([] as (HTMLSpanElement | null)[]);
  const shadows = React.useRef([] as (HTMLSpanElement | null)[]);
  const anchors = React.useRef([] as (HTMLSpanElement | null)[]);
  const sim = React.useRef(makeSim());
  const returnFocus = React.useRef(null as number | null);

  const [size, setSize] = React.useState({ section: 0, stage: 0 });
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [lifted, setLifted] = React.useState<number | null>(null);
  const [reduced, setReduced] = React.useState(false);
  const [failed, setFailed] = React.useState({} as { [id: string]: boolean });

  const wide = size.section >= WIDE;
  const narrow = size.section > 0 && size.section < 480;
  const kb = narrow ? 0.62 : 0.68;

  // Large full-width belt & large plates
  const geo = React.useMemo(() => {
    if (!size.stage || count === 0) return null;
    const span = halfSpan(makeGeo(1000, count, 100, kb)) / 100;
    const cap = wide ? 220 : clamp(size.section * 0.22, 130, 220);
    const fit = (size.stage - 12) / (2 * span);
    return makeGeo(size.stage, count, Math.round(clamp(fit, Math.min(125, cap), cap)), kb);
  }, [size.stage, size.section, count, kb, wide]);

  const live = React.useRef({
    geo: null as Geo | null,
    hovered: null as number | null,
    open: false,
    count: 0,
    speed: 38,
    onOpenChange: undefined as ((index: number | null) => void) | undefined,
    onAdd: undefined as ((item: ConveyorDish) => void) | undefined,
  });
  live.current = {
    geo,
    hovered: hoveredIndex,
    open: openIndex !== null,
    count,
    speed: Math.max(20, speed),
    onOpenChange,
    onAdd,
  };

  const setSectionRef = React.useCallback(
    (node: HTMLElement | null) => {
      sectionRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const paintPlate = React.useCallback((i: number) => {
    const L = live.current;
    const g = L.geo;
    const s = sim.current;
    const button = plates.current[i];
    if (!g || !button) return;
    const q = pose(g, s.offset, i);
    const e = s.lift[i] ?? 0;
    button.style.transform = `translate3d(${(q.x - g.d / 2).toFixed(2)}px,${(q.y - (g.d * TILT) / 2).toFixed(2)}px,0) scale(${q.k.toFixed(4)})`;
    const z = i === L.hovered ? 2000 : 100 + Math.round(q.y);
    if (s.z[i] !== z) {
      s.z[i] = z;
      button.style.zIndex = String(z);
    }
    const lane = q.depth >= 0.5 ? "front" : "back";
    if (s.lane[i] !== lane) {
      s.lane[i] = lane;
      button.dataset.lane = lane;
    }
    const lift = lifts.current[i];
    if (lift) {
      lift.style.transform = `translateY(${(LIFT_Y * e).toFixed(3)}%) scale(${(1 + LIFT_SCALE * e).toFixed(4)})`;
    }
    const shade = shades.current[i];
    if (shade) {
      shade.style.opacity = (BACK_SHADE * clamp(1 - q.depth, 0, 1) * (1 - 0.7 * clamp(e, 0, 1))).toFixed(3);
    }
    const shadow = shadows.current[i];
    if (shadow) {
      shadow.style.transform = `translate3d(0,${(g.d * TILT * 0.05 * e).toFixed(2)}px,0) scale(${(1 + 0.14 * e).toFixed(3)})`;
      shadow.style.opacity = (1 - 0.5 * clamp(e, 0, 1)).toFixed(3);
    }
    const anchor = anchors.current[i];
    if (anchor) {
      anchor.style.transform = `scale(${(1 / (q.k * (1 + LIFT_SCALE * e))).toFixed(4)})`;
    }
  }, []);

  const paintBelt = React.useCallback(() => {
    const L = live.current;
    const g = L.geo;
    const s = sim.current;
    if (!g) return;
    seamRef.current?.setAttribute("d", slatPath(g, s.offset, 0));
    glintRef.current?.setAttribute("d", slatPath(g, s.offset, -Math.max(1.4, g.d * 0.024)));
  }, []);

  const paintAll = React.useCallback(() => {
    for (let i = 0; i < live.current.count; i++) paintPlate(i);
    paintBelt();
  }, [paintPlate, paintBelt]);

  // Belt ALWAYS moves continuously in circles
  const tick = React.useCallback(
    (now: number) => {
      const s = sim.current;
      const L = live.current;
      const g = L.geo;
      s.raf = 0;
      if (!g || !s.visible) {
        s.last = 0;
        return;
      }
      const dt = s.last ? clamp((now - s.last) / 1000, 0, 0.25) : 1 / 60;
      s.last = now;
      const steps = Math.max(1, Math.ceil(dt / 0.017));
      const h = dt / steps;
      const cruise = L.speed;

      for (let step = 0; step < steps; step++) {
        s.v = cruise;
        s.offset += s.v * h;

        for (let i = 0; i < L.count; i++) {
          const goal = i === L.hovered ? 1 : 0;
          const x = s.lift[i] ?? 0;
          const v = (s.vlift[i] ?? 0) + (330 * (goal - x) - 23 * (s.vlift[i] ?? 0)) * h;
          s.lift[i] = x + v * h;
          s.vlift[i] = v;
        }
      }

      paintAll();
      s.raf = requestAnimationFrame(tick);
    },
    [paintAll]
  );

  const kick = React.useCallback(() => {
    const s = sim.current;
    if (s.raf || !s.visible) return;
    s.last = 0;
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const open = React.useCallback((index: number) => {
    setOpenIndex(index);
    live.current.onOpenChange?.(index);
  }, []);

  const close = React.useCallback(() => {
    setOpenIndex(null);
    live.current.onOpenChange?.(null);
    kick();
  }, [kick]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const measure = () => {
      const next = { section: Math.round(section.clientWidth), stage: Math.round(stage.clientWidth) };
      setSize((old) => (old.section === next.section && old.stage === next.stage ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [count > 0]);

  React.useLayoutEffect(() => {
    const s = sim.current;
    if (!geo) return;
    if (!s.init) {
      s.init = true;
      s.offset = geo.s / 2;
      s.v = live.current.speed;
    } else if (s.l > 0 && s.l !== geo.l) {
      const f = geo.l / s.l;
      s.offset *= f;
    }
    s.l = geo.l;
    s.z = [];
    s.lane = [];
    paintAll();
    kick();
  }, [geo, items, paintAll, kick]);

  React.useEffect(() => {
    const node = sectionRef.current;
    const s = sim.current;
    let inView = true;
    const update = () => {
      const visible = inView && !document.hidden;
      if (visible === s.visible) return;
      s.visible = visible;
      if (visible) kick();
      else if (s.raf) {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        s.last = 0;
      }
    };
    const observer =
      node && typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            inView = entries.some((entry) => entry.isIntersecting);
            update();
          })
        : null;
    if (node && observer) observer.observe(node);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [kick]);

  React.useEffect(
    () => () => {
      const s = sim.current;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.last = 0;
    },
    []
  );

  React.useLayoutEffect(() => {
    if (openIndex !== null || lifted !== null || returnFocus.current === null) return;
    const index = returnFocus.current;
    returnFocus.current = null;
    plates.current[index]?.focus({ preventScroll: true });
  }, [openIndex, lifted]);

  const openSource = React.useCallback(
    () => (openIndex === null ? null : lifts.current[openIndex]?.getBoundingClientRect() ?? null),
    [openIndex]
  );
  const onLift = React.useCallback((on: boolean) => setLifted(on ? openIndex : null), [openIndex]);
  const onDialogClose = React.useCallback(() => {
    returnFocus.current = openIndex;
    close();
  }, [openIndex, close]);
  const onDialogAdd = React.useCallback(() => {
    const item = openIndex === null ? undefined : items[openIndex];
    if (item) live.current.onAdd?.(item);
  }, [openIndex, items]);

  const paths = React.useMemo(
    () =>
      geo
        ? {
            outer: edgePath(geo, geo.band / 2),
            inner: edgePath(geo, -geo.band / 2),
            island: edgePath(geo, -geo.band / 2 - geo.d * 0.035),
          }
        : null,
    [geo]
  );
  const g = geo;

  return (
    <section
      {...rest}
      ref={setSectionRef}
      data-slot="sushi-conveyor-menu"
      className={`relative isolate w-full overflow-hidden bg-background text-foreground ${THEME} ${className ?? ""}`}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center px-4 md:px-10 py-10 md:py-14">
        {heading && (
          <h2 className="mb-6 text-center text-balance font-black tracking-tighter text-[#121214] text-3xl sm:text-4xl md:text-5xl">
            {heading}
          </h2>
        )}

        {count > 0 && (
          <div
            ref={stageRef}
            data-stage
            role="group"
            aria-label={heading ?? "Sushi conveyor belt"}
            aria-roledescription="conveyor belt"
            className="relative w-full select-none"
            style={{ height: g ? g.height : 340, overflowX: "clip" }}
          >
            {g && (
              <div
                aria-hidden="true"
                data-counter
                className="pointer-events-none absolute inset-x-0"
                style={{
                  top: Math.max(0, g.edgeTop - g.d * 0.34),
                  height: g.ym - Math.max(0, g.edgeTop - g.d * 0.34),
                  background:
                    "linear-gradient(to bottom, color-mix(in oklab, var(--color-foreground) 9%, transparent) 0 1px, transparent 1px, color-mix(in oklab, var(--color-foreground) 5%, transparent) 40%, transparent)",
                  WebkitMaskImage: "linear-gradient(to right, transparent, black 18%, black 82%, transparent)",
                  maskImage: "linear-gradient(to right, transparent, black 18%, black 82%, transparent)",
                }}
              />
            )}
            <div ref={beltRef} data-belt aria-hidden="true" className="pointer-events-none absolute inset-0">
              {g && paths && (
                <svg
                  className="absolute left-0 top-0 overflow-visible"
                  width={g.width}
                  height={g.height}
                  viewBox={`0 0 ${g.width} ${g.height}`}
                  focusable="false"
                >
                  <defs>
                    <filter id={`${uid}-soft`} x="-10%" y="-30%" width="120%" height="160%">
                      <feGaussianBlur stdDeviation={(g.d * 0.06).toFixed(1)} />
                    </filter>
                    <linearGradient id={`${uid}-island`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" style={{ stopColor: "var(--island)" }} />
                      <stop offset="1" style={{ stopColor: "var(--island-low)" }} />
                    </linearGradient>
                  </defs>
                  <path
                    d={paths.outer}
                    transform={`translate(0 ${(g.side + g.d * 0.07).toFixed(1)})`}
                    fill="black"
                    className="opacity-[0.18]"
                    filter={`url(#${uid}-soft)`}
                  />
                  <path
                    d={`${paths.outer}${paths.inner}`}
                    fillRule="evenodd"
                    transform={`translate(0 ${g.side.toFixed(1)})`}
                    style={{ fill: "var(--belt-side)" }}
                  />
                  <path d={`${paths.outer}${paths.inner}`} fillRule="evenodd" style={{ fill: "var(--belt)" }} />
                  <path
                    ref={seamRef}
                    fill="none"
                    stroke="black"
                    strokeOpacity={0.42}
                    strokeWidth={Math.max(1, g.d * 0.013)}
                    strokeLinecap="round"
                  />
                  <path
                    ref={glintRef}
                    fill="none"
                    stroke="white"
                    strokeOpacity={0.14}
                    strokeWidth={Math.max(0.8, g.d * 0.009)}
                    strokeLinecap="round"
                  />
                  <path
                    d={paths.outer}
                    fill="none"
                    style={{ stroke: "var(--rail)" }}
                    strokeWidth={Math.max(2, g.d * 0.026)}
                  />
                  <path
                    d={paths.outer}
                    fill="none"
                    stroke="white"
                    strokeOpacity={0.55}
                    strokeWidth={Math.max(0.8, g.d * 0.008)}
                    transform="translate(0 -0.8)"
                  />
                  <path
                    d={paths.inner}
                    fill="none"
                    style={{ stroke: "var(--rail)" }}
                    strokeWidth={Math.max(1.6, g.d * 0.02)}
                  />
                  <path
                    d={paths.inner}
                    fill="none"
                    stroke="white"
                    strokeOpacity={0.4}
                    strokeWidth={Math.max(0.8, g.d * 0.008)}
                    transform="translate(0 -0.7)"
                  />
                  <path d={paths.island} style={{ fill: "var(--island-wall)" }} />
                  <path
                    d={paths.island}
                    transform={`translate(0 ${(-g.side * 0.6).toFixed(1)})`}
                    style={{ fill: `url(#${uid}-island)` }}
                  />
                  <path
                    d={paths.island}
                    transform={`translate(0 ${(-g.side * 0.6 - 0.6).toFixed(1)})`}
                    fill="none"
                    stroke="white"
                    strokeOpacity={0.55}
                    strokeWidth={Math.max(0.8, g.d * 0.008)}
                  />
                </svg>
              )}
            </div>
            {g &&
              items.map((item, i) => {
                const tier = tierStyle(item.tier);
                const broken = !!failed[item.id];
                const isHovered = hoveredIndex === i;
                const mask = `url("${item.image}") 0 0 / 100% 100% no-repeat`;
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      plates.current[i] = node;
                    }}
                    type="button"
                    data-dish={i}
                    aria-label={`${item.name}, ${item.price}`}
                    aria-haspopup="dialog"
                    className="absolute left-0 top-0 cursor-pointer rounded-[50%] outline-none"
                    style={{
                      width: g.d,
                      height: g.d * TILT,
                      visibility: lifted === i ? "hidden" : undefined,
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex((cur) => (cur === i ? null : cur))}
                    onClick={() => open(i)}
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50">
                      <span
                        ref={(node) => {
                          shadows.current[i] = node;
                        }}
                        className="absolute inset-x-[5%] bottom-[-9%] top-[16%] rounded-[50%] bg-black"
                        style={{ filter: `blur(${Math.max(2, g.d * 0.045).toFixed(1)}px)` }}
                      />
                    </span>
                    <span
                      ref={(node) => {
                        lifts.current[i] = node;
                      }}
                      data-lift
                      className="absolute inset-0"
                    >
                      <span
                        aria-hidden="true"
                        data-placeholder
                        className={`absolute rounded-[50%] border border-border bg-card ${
                          broken ? "inset-[3%] shadow-sm" : "inset-[6%]"
                        }`}
                      >
                        <span className="absolute inset-[30%] rounded-[50%] bg-muted-foreground/20" />
                      </span>
                      {!broken && (
                        <img
                          src={item.image}
                          alt=""
                          draggable={false}
                          onError={() =>
                            setFailed((old) => (old[item.id] ? old : { ...old, [item.id]: true }))
                          }
                          className="pointer-events-none absolute inset-0 size-full select-none object-fill"
                        />
                      )}
                      {!broken && (
                        <span
                          ref={(node) => {
                            shades.current[i] = node;
                          }}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-black"
                          style={{ opacity: 0, WebkitMask: mask, mask }}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        data-ring
                        className={`pointer-events-none absolute -inset-[2%] rounded-[50%] border-2 ${tier.ring}`}
                      />
                      <span
                        ref={(node) => {
                          anchors.current[i] = node;
                        }}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-0 size-0"
                      >
                        <span
                          data-chip
                          className={`absolute bottom-[7px] left-0 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap border border-[#121214] bg-[#FDFBF7] py-1 pl-2.5 pr-3 text-[11px] font-bold leading-none text-[#121214] shadow-md transition-[opacity,translate] duration-200 ${
                            isHovered && lifted !== i
                              ? "translate-y-0 opacity-100"
                              : "translate-y-1 opacity-0"
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${tier.dot}`} />
                          {item.name}
                          <span className="font-mono tabular-nums text-[#3A403C]">{item.price}</span>
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {openIndex !== null && items[openIndex] && (
        <DishDialog
          uid={uid}
          item={items[openIndex]}
          index={openIndex}
          total={count}
          labels={labels}
          reduced={reduced}
          broken={!!failed[items[openIndex].id]}
          source={openSource}
          onLift={onLift}
          onAdd={onDialogAdd}
          onClose={onDialogClose}
        />
      )}
    </section>
  );
}

function DishDialog({
  uid,
  item,
  index,
  total,
  labels,
  reduced,
  broken,
  source,
  onLift,
  onAdd,
  onClose,
}: {
  uid: string;
  item: ConveyorDish;
  index: number;
  total: number;
  labels: SushiConveyorMenuLabels;
  reduced: boolean;
  broken: boolean;
  source: () => DOMRect | null;
  onLift: (lifted: boolean) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const dialogRef = React.useRef(null as HTMLDivElement | null);
  const figureRef = React.useRef(null as HTMLDivElement | null);
  const closeRef = React.useRef(null as HTMLButtonElement | null);
  const rafAnim = React.useRef(0);
  const closing = React.useRef(false);
  const [shown, setShown] = React.useState(false);
  const titleId = `${uid}-dish-title`;
  const tier = tierStyle(item.tier);

  React.useLayoutEffect(() => {
    const figure = figureRef.current;
    const from = source();
    closeRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onLift(true);
    let animation = null as Animation | null;
    if (figure && from && !reduced && from.width > 0) {
      const to = figure.getBoundingClientRect();
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      animation = figure.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})` },
          { transform: "translate3d(0, 0, 0) scale(1, 1)" },
        ],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(raf);
      if (rafAnim.current) cancelAnimationFrame(rafAnim.current);
      animation?.cancel();
      document.body.style.overflow = overflow;
      onLift(false);
    };
  }, [source, reduced, onLift]);

  const dismiss = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    const figure = figureRef.current;
    const initialTo = source();
    if (!figure || !initialTo || reduced || initialTo.width === 0) {
      onClose();
      return;
    }
    const from = figure.getBoundingClientRect();
    const duration = 220;
    const start = performance.now();

    const step = (now: number) => {
      const rawT = clamp((now - start) / duration, 0, 1);
      // Direct smooth ease-out straight to the live moving belt slot
      const e = 1 - Math.pow(1 - rawT, 3);
      const liveTo = source() ?? initialTo;
      const sx = 1 + (liveTo.width / from.width - 1) * e;
      const sy = 1 + (liveTo.height / from.height - 1) * e;
      const dx = (liveTo.left + liveTo.width / 2 - (from.left + from.width / 2)) * e;
      const dy = (liveTo.top + liveTo.height / 2 - (from.top + from.height / 2)) * e;
      figure.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;

      if (rawT < 1) {
        rafAnim.current = requestAnimationFrame(step);
      } else {
        rafAnim.current = 0;
        onClose();
      }
    };

    rafAnim.current = requestAnimationFrame(step);
  }, [source, reduced, onClose]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(event.target as Node)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      } else if (event.key === "Tab") {
        const first = dialog.querySelector("button");
        if (first) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll("button") ?? [])].filter(
      (node) => !node.disabled
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const add = () => {
    if (closing.current) return;
    onAdd();
    dismiss();
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-dish-dialog
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 text-foreground sm:p-8"
      onKeyDown={onKeyDown}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-150 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={dismiss}
      />
      <div className="relative grid w-full max-w-[52rem] items-center gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] sm:gap-10 sm:p-8">
        <div
          aria-hidden="true"
          className={`absolute inset-0 border-2 border-[#121214] bg-[#FDFBF7] shadow-2xl transition-opacity duration-150 motion-reduce:transition-none ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        />
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          className={`absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 border border-[#121214] bg-[#FDFBF7] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#121214] hover:bg-[#121214] hover:text-[#FDFBF7] cursor-pointer transition-opacity duration-150 ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        >
          {labels.close}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
        <div ref={figureRef} data-dish-figure className="relative mx-auto aspect-square w-full max-w-[min(42vh,22rem)]">
          <span
            aria-hidden="true"
            className="absolute inset-x-[8%] bottom-[-4%] top-[14%] rounded-full bg-black opacity-25 blur-2xl"
          />
          {broken ? (
            <span aria-hidden="true" className="absolute inset-[3%] rounded-full border border-border bg-muted">
              <span className="absolute inset-[30%] rounded-full bg-muted-foreground/25" />
            </span>
          ) : (
            <img src={item.image} alt={item.name} draggable={false} className="relative size-full select-none object-contain" />
          )}
          <span aria-hidden="true" className={`absolute -inset-[1.5%] rounded-full border-[3px] ${tier.ring}`} />
        </div>
        <div
          className={`relative flex flex-col gap-3 text-center transition-opacity duration-150 motion-reduce:transition-none sm:text-left ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.2em] text-[#3A403C] sm:justify-start">
            <span aria-hidden="true" className={`size-2 rounded-full ${tier.dot}`} />
            OPTION {pad(index + 1)} / {pad(total)}
          </p>
          <h3 id={titleId} className="text-2xl font-black tracking-tighter text-[#121214] sm:text-3xl">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs sm:text-sm leading-relaxed text-[#3A403C]">{item.description}</p>
          )}
          {item.details && item.details.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {item.details.map((detail) => (
                <li
                  key={detail}
                  className="border border-[#121214]/30 bg-[#C2D8C4]/30 px-2.5 py-1 text-[11px] font-mono text-[#121214]"
                >
                  {detail}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <p className="text-2xl font-black font-mono tabular-nums tracking-tight text-[#121214]">
              {item.price}
            </p>
            <button
              type="button"
              data-add
              onClick={add}
              className="inline-flex items-center gap-2 bg-[#121214] px-6 py-3 text-xs font-black uppercase tracking-widest text-[#FDFBF7] hover:opacity-90 cursor-pointer"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
              {labels.add}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SushiConveyorMenu;
