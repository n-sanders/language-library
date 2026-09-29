import { Shelf, type ShelfProgress } from "@/components/bookshelf/Shelf";
import { SiteHeader } from "@/components/SiteHeader";
import { BOOKS } from "@/content/books";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/progress";

export default async function HomePage() {
  const user = await requireUser();
  const progress = getProgress(user.id);

  const shelfProgress: ShelfProgress = {};
  for (const [key, stats] of Object.entries(progress)) {
    shelfProgress[key] = {
      exercisesCompleted: stats.exercisesCompleted,
      recentAccuracy: stats.recentAccuracy,
      mastered: stats.mastered,
    };
  }

  return (
    <div className="library-wall flex min-h-screen flex-col">
      <SiteHeader user={user} dark />
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <p className="mb-8 text-center font-book text-xl text-amber-100">Pick a book from the shelf.</p>
        <Shelf books={BOOKS} progress={shelfProgress} />
      </main>
    </div>
  );
}
