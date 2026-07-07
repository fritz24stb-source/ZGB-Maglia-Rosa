"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { mainNavItems } from "@/lib/navigation";
import { cn } from "@/lib/ui";

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname.startsWith("/admin") : pathname === href;
}

export function MainNav() {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <nav className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex w-full items-center justify-between gap-3">
        <Link
          href="/leaderboard"
          className="focus-ring flex items-center gap-3 rounded-lg"
        >
          <span className="zgb-app-brand-mark flex h-11 w-11 items-center justify-center rounded-full">
            <Image
              src="/pwa-icon.svg"
              width={36}
              height={36}
              alt=""
              aria-hidden
              className="h-9 w-9"
              priority
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="zgb-app-page-title text-sm">ZGB Rangliste</span>
            <span className="mt-1 text-xs font-medium text-asphalt-500">
              Strava-Wertung
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {mainNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="zgb-nav-link focus-ring"
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-asphalt-300 bg-white/70 text-asphalt-800 md:hidden"
          aria-label={
            mobileNavOpen ? "Navigation schließen" : "Navigation öffnen"
          }
          aria-controls="mobile-navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? (
            <X aria-hidden className="h-5 w-5" />
          ) : (
            <Menu aria-hidden className="h-5 w-5" />
          )}
        </button>
      </div>

      <div
        id="mobile-navigation"
        className={cn(
          "border-t border-asphalt-200 pt-3 md:hidden",
          mobileNavOpen ? "block" : "hidden",
        )}
      >
        <div className="flex flex-col gap-1">
          {mainNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="zgb-nav-link focus-ring"
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
