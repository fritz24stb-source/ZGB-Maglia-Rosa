import { MainNav } from "@/components/main-nav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-asphalt-200 bg-white/95 backdrop-blur">
        <MainNav />
      </header>
      {children}
    </div>
  );
}
