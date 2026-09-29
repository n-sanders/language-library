import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { SessionUser } from "@/lib/auth";

export function SiteHeader({ user, dark = false }: { user: SessionUser; dark?: boolean }) {
  const text = dark ? "text-amber-50" : "text-amber-950";
  return (
    <header className={`flex items-center justify-between gap-4 px-6 py-4 ${text}`}>
      <Link href="/" className="font-book text-2xl font-bold tracking-wide">
        Language Library
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <span className="hidden opacity-90 sm:inline">Hi, {user.displayName}!</span>
        {user.role === "admin" && (
          <Link href="/admin" className="font-semibold underline-offset-4 hover:underline">
            Admin
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className="font-semibold underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
