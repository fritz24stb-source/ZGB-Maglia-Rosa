import type { UserRole } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

export const mainNavItems: NavItem[] = [
  { href: "/leaderboard", label: "Leaderboard", roles: ["admin", "member"] },
  { href: "/manual", label: "Manuell", roles: ["admin", "member"] },
  { href: "/profile", label: "Profil", roles: ["admin", "member"] },
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

export const adminSections = [
  {
    href: "/admin/seasons",
    label: "Saisons",
    description: "Start, Ende und aktive Saison verwalten.",
  },
  {
    href: "/admin/rules",
    label: "Regeln",
    description: "Sonderevents und Wertungsregeln pflegen.",
  },
  {
    href: "/admin/members",
    label: "Mitglieder",
    description: "Status, Rollen und Strava-Verbindungen pruefen.",
  },
  {
    href: "/admin/activities",
    label: "Aktivitaeten",
    description: "Bewertungen pruefen, neu bewerten oder ausschliessen.",
  },
  {
    href: "/admin/export",
    label: "Export",
    description: "CSV-Ausgaben fuer Ranglisten und Aktivitaeten erstellen.",
  },
] as const;
