import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in - Language Library" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  return (
    <main className="library-wall flex min-h-screen items-center justify-center p-6">
      <div className="paper w-full max-w-sm rounded-xl p-8 shadow-2xl">
        <h1 className="mb-1 text-center font-book text-3xl font-bold text-amber-950">Language Library</h1>
        <p className="mb-6 text-center text-amber-800">Sign in to pick a book from the shelf.</p>
        <LoginForm />
      </div>
    </main>
  );
}
