"use client";
/**
 * Aceternity UI FloatingDock component
 * Adapted to support both link navigation (`href`) and interactive action callbacks (`onClick`),
 * active item indicators, badge counts, and unified portrait/mobile macOS-style spring magnification dock.
 **/

import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

import React, { useRef, useState } from "react";

export type FloatingDockItem = {
  title: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
};

export const FloatingDock = ({
  items,
  desktopClassName,
  mobileClassName,
}: {
  items: FloatingDockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
}) => {
  return (
    <FloatingDockBar
      items={items}
      className={cn(desktopClassName, mobileClassName)}
    />
  );
};

const FloatingDockBar = ({
  items,
  className,
}: {
  items: FloatingDockItem[];
  className?: string;
}) => {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.nav
      aria-label="Portrait floating dock navigation"
      initial={{ y: 80, opacity: 0, scale: 0.92 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 80, opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      onTouchMove={(e) => {
        if (e.touches[0]) mouseX.set(e.touches[0].pageX);
      }}
      onTouchEnd={() => mouseX.set(Infinity)}
      className={cn(
        "rb-floating-dock mx-auto flex h-16 items-end gap-2 sm:gap-3 rounded-2xl px-3 pb-2.5",
        className
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.nav>
  );
};

function IconContainer({
  mouseX,
  title,
  icon,
  href,
  onClick,
  active,
  badge,
}: FloatingDockItem & {
  mouseX: MotionValue;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-130, 0, 130], [40, 64, 40]);
  const heightTransform = useTransform(distance, [-130, 0, 130], [40, 64, 40]);

  const widthTransformIcon = useTransform(distance, [-130, 0, 130], [19, 30, 19]);
  const heightTransformIcon = useTransform(
    distance,
    [-130, 0, 130],
    [19, 30, 19]
  );

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 170,
    damping: 13,
  });
  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 170,
    damping: 13,
  });

  const widthIcon = useSpring(widthTransformIcon, {
    mass: 0.1,
    stiffness: 170,
    damping: 13,
  });
  const heightIcon = useSpring(heightTransformIcon, {
    mass: 0.1,
    stiffness: 170,
    damping: 13,
  });

  const [hovered, setHovered] = useState(false);

  const content = (
    <motion.div
      ref={ref}
      style={{ width, height }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        "rb-dock-item relative flex aspect-square items-center justify-center rounded-full transition-colors",
        active && "rb-dock-item-active"
      )}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 2, x: "-50%" }}
            className="rb-dock-tooltip absolute -top-9 left-1/2 w-fit rounded-lg px-2.5 py-1 text-xs font-medium whitespace-pre shadow-md pointer-events-none"
          >
            {title}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        style={{ width: widthIcon, height: heightIcon }}
        className="flex items-center justify-center"
      >
        {icon}
      </motion.div>
      {typeof badge === "number" && badge > 0 && (
        <span className="rb-dock-badge">{badge > 99 ? "99+" : badge}</span>
      )}
      {active && <span className="rb-dock-active-dot" aria-hidden="true" />}
    </motion.div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={title}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        className="rb-dock-trigger"
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href={href || "#"}
      aria-label={title}
      aria-current={active ? "page" : undefined}
      className="rb-dock-trigger"
    >
      {content}
    </a>
  );
}
