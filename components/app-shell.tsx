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
    </div>
  );
}
