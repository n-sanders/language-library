import Link from "next/link";
import { notFound } from "next/navigation";
import { PracticeApp } from "@/components/sentence/PracticeApp";
import { SiteHeader } from "@/components/SiteHeader";
import { getBook, getChapter } from "@/content/books";
import { requireUser } from "@/lib/auth";

export async function generateMetadata({ params }: { params: Promise<{ book: string; chapter: string }> }) {
  const { book, chapter } = await params;
  const found = getChapter(book, chapter);
  return { title: found ? `${found.chapter.title} - Language Library` : "Language Library" };
}

export default async function PracticePage({ params }: { params: Promise<{ book: string; chapter: string }> }) {
  const user = await requireUser();
  const { book: bookSlug, chapter: chapterSlug } = await params;
  const book = getBook(bookSlug);
  if (!book) notFound();

  const found = getChapter(bookSlug, chapterSlug);
  if (book.status === "coming-soon" || !found) {
    if (book.status !== "coming-soon") notFound();
    return (
      <div className="paper min-h-screen">
        <SiteHeader user={user} />
        <main className="mx-auto max-w-xl p-10 text-center">
          <h1 className="font-book text-3xl font-bold">{book.title} is coming soon!</h1>
          <p className="mt-3 text-amber-800">This book is still being written.</p>
          <Link href="/" className="btn-secondary mt-6">
            Back to the shelf
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="paper min-h-screen">
      <SiteHeader user={user} />
      <PracticeApp
        bookSlug={book.slug}
        bookTitle={book.title}
        chapter={found.chapter}
        studentName={user.displayName}
      />
    </div>
  );
}
