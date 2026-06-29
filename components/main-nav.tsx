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
          className="focus-ring flex items-center gap-2 rounded-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-asphalt-900">
            <Image
              src="/pwa-icon.svg"
              width={28}
              height={28}
              alt=""
              aria-hidden
              className="h-7 w-7"
              priority
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-asphalt-900">
              ZGB Rangliste
            </span>
            <span className="text-xs text-asphalt-500">Strava-Wertung</span>
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
                className={cn(
                  "focus-ring rounded-md px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-asphalt-900 text-white"
                    : "text-asphalt-700 hover:bg-asphalt-100 hover:text-asphalt-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-asphalt-300 text-asphalt-800 md:hidden"
          aria-label={
            mobileNavOpen ? "Navigation schliessen" : "Navigation oeffnen"
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
                className={cn(
                  "focus-ring rounded-md px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-asphalt-900 text-white"
                    : "text-asphalt-700 hover:bg-asphalt-100 hover:text-asphalt-900",
                )}
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
