import { requireAdminAppPage } from "@/lib/auth/page-guard";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const guard = await requireAdminAppPage("/admin");

  return guard ?? children;
}
