import Link from "next/link";
import { MainNav } from "@/components/main-nav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="zgb-app flex min-h-screen flex-col">
      <header className="zgb-app-header sticky top-0 z-20 backdrop-blur-md">
        <MainNav />
      </header>
      {children}
      <footer className="mt-auto border-t border-asphalt-200">
        <div className="mx-auto flex w-full max-w-6xl justify-end gap-4 px-4 py-4 text-sm text-asphalt-500 sm:px-6 lg:px-8">
          <Link className="focus-ring rounded-sm" href="/faq">
            FAQ
          </Link>
          <Link className="focus-ring rounded-sm" href="/datenschutz">
            Datenschutz
          </Link>
        </div>
      </footer>
    </div>
  );
}
