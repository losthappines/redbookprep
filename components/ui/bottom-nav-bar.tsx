"use client";

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Home, BookOpen, PencilLine, CircleHelp, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavItem = { label: string; icon: LucideIcon; href: string };

const navItems: NavItem[] = [
  { label: 'Home', icon: Home, href: '#main' },
  { label: 'Approach', icon: BookOpen, href: '#method' },
  { label: 'Practice', icon: PencilLine, href: '#sample' },
  { label: 'FAQs', icon: CircleHelp, href: '#faq' },
  { label: 'Log in', icon: User, href: '/login' },
];

export type BottomNavBarProps = {
  className?: string;
  defaultIndex?: number;
  stickyBottom?: boolean;
};

// The supplied pill interaction is used at the top; bottom placement remains optional.
export function BottomNavBar({ className, defaultIndex = 0, stickyBottom = false }: BottomNavBarProps) {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, Math.min(defaultIndex, navItems.length - 1)));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const sections = navItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.href.startsWith('#'));
    let scheduled = false;
    let clickLockUntil = 0;

    const update = () => {
      scheduled = false;
      if (Date.now() < clickLockUntil) return;
      let selected = 0;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 36;
      if (atBottom && sections.length > 0) {
        selected = sections[sections.length - 1].index;
      } else {
        sections.forEach(({ item, index }) => {
          const element = document.querySelector(item.href);
          if (element && element.getBoundingClientRect().top <= 180) {
            selected = index;
          }
        });
      }
      setActiveIndex(selected);
    };

    const onHashOrPop = () => {
      const hash = window.location.hash;
      const matched = sections.find(({ item }) => item.href === hash);
      if (matched) {
        clickLockUntil = Date.now() + 650;
        setActiveIndex(matched.index);
      } else {
        clickLockUntil = 0;
        update();
      }
    };

    const onScroll = () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    };

    if (window.location.hash) {
      onHashOrPop();
    } else {
      update();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', onHashOrPop);
    window.addEventListener('popstate', onHashOrPop);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('hashchange', onHashOrPop);
      window.removeEventListener('popstate', onHashOrPop);
    };
  }, []);

  return (
    <motion.nav
      initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      aria-label="Main navigation"
      className={cn(
        'pill-nav bg-card border border-border rounded-full flex items-center p-1.5 shadow-xl gap-1 w-fit max-w-full h-[56px]',
        stickyBottom && 'fixed inset-x-0 bottom-4 mx-auto z-20',
        className
      )}
    >
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const active = activeIndex === index;
        return (
          <motion.a
            key={item.label}
            href={item.href}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            onClick={() => {
              if (item.href.startsWith('#')) {
                setActiveIndex(index);
              }
            }}
            aria-label={item.label}
            aria-current={active ? 'location' : undefined}
            title={item.label}
            className={cn(
              'pill-link flex items-center rounded-full relative h-11 min-w-11 px-3 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon size={21} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{
                width: active ? 68 : 0,
                opacity: active ? 1 : 0,
                marginLeft: active ? 8 : 0,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      width: { type: 'spring', stiffness: 350, damping: 32 },
                      opacity: { duration: 0.19 },
                      marginLeft: { duration: 0.19 },
                    }
              }
              className="overflow-hidden flex items-center"
            >
              <span className="font-medium text-xs whitespace-nowrap select-none">
                {item.label}
              </span>
            </motion.span>
          </motion.a>
        );
      })}
    </motion.nav>
  );
}

export default BottomNavBar;
