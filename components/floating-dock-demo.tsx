import React from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  Github,
  Twitter,
  ArrowLeftRight,
  Home,
  PlusSquare,
  Terminal,
} from "lucide-react";

export default function FloatingDockDemo() {
  const links = [
    {
      title: "Home",
      icon: (
        <Home className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "#",
    },
    {
      title: "Products",
      icon: (
        <Terminal className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "#",
    },
    {
      title: "Components",
      icon: (
        <PlusSquare className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "#",
    },
    {
      title: "RedBookPrep",
      icon: (
        <img
          src="/opengraph-image"
          width={20}
          height={20}
          alt="RedBookPrep Logo"
        />
      ),
      href: "/",
    },
    {
      title: "Changelog",
      icon: (
        <ArrowLeftRight className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "#",
    },
    {
      title: "Twitter",
      icon: (
        <Twitter className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "#",
    },
    {
      title: "GitHub",
      icon: (
        <Github className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "#",
    },
  ];
  return (
    <div className="flex items-center justify-center h-[35rem] w-full">
      <FloatingDock items={links} />
    </div>
  );
}
