import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { SiteHeader } from "@/components/SiteHeader";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin - Language Library" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const openReports =
    getDb()
      .select({ n: count() })
      .from(schema.problemReports)
      .where(eq(schema.problemReports.status, "open"))
      .get()?.n ?? 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-amber-50">
        <SiteHeader user={user} />
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          <Tab href="/admin">Students</Tab>
          <Tab href="/admin/settings">AI settings</Tab>
          <Tab href="/admin/audit">AI audit</Tab>
          <Tab href="/admin/reports">
            Problem reports
            {openReports > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">{openReports}</span>
            )}
          </Tab>
        </nav>
      </div>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

function Tab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-t-lg px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-white/70"
    >
      {children}
    </Link>
  );
}
