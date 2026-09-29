# Language Library

Homeschool language practice. Students pick a book off an animated bookshelf, open a chapter, and practice in a
separate page. The first full book is **Parts of a Sentence**: students pick a topic, the AI writes a sentence about
it, and they tap words to tag subjects, nouns, verbs, adjectives, adverbs, prepositional phrases, dependent clauses, and
subordinating conjunctions. An AI helper coaches them without giving away the answer. **Spelling** is a placeholder.

Stack: Next.js 15 (App Router, TypeScript), SQLite (Drizzle ORM + better-sqlite3), Tailwind CSS, Framer Motion,
OpenRouter for AI.

## Run it locally (Windows, no Docker)

Requires Node.js 22 or newer.

```powershell
npm install
npm run setup     # creates .env.local with a random APP_SECRET (only needed once)
npm run dev       # http://localhost:3000
```

Sign in as `admin` / `admin` (from `.env.local`). Then:

1. Go to **Admin > AI settings**, paste your OpenRouter API key, and click **Test connection**.
2. Go to **Admin > Students** and add a student.
3. Sign out, sign in as the student, and pick a book.

The database lives at `./data/app.db`. It is created automatically on first start, migrations run on every start, and
the admin account is created if none exists.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` then `npm run start` | Production build, run locally |
| `npm run db:reset` | Delete the local database (stop the server first); the next start recreates it |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run db:generate` | Create a new migration after editing `src/db/schema.ts` |
| `npm run typecheck` | TypeScript check |

## Deploy with Docker (web server)

On the server, in a copy of this repo:

```bash
cp .env.example .env
# edit .env: set a long random APP_SECRET and a real ADMIN_PASSWORD
mkdir -p data && sudo chown 1000:1000 data   # the container runs as the "node" user (uid 1000)
docker compose up -d --build
```

The app listens on port 3000 (change the left side of `ports` in `docker-compose.yml` to use another port). The
database is stored in `./data/app.db` on the host through the volume mount, so it survives rebuilds.

To update: `git pull && docker compose up -d --build`. Migrations run automatically when the container starts.

You can also run `docker compose up --build` on your development machine if Docker Desktop is installed, to check the
production image before deploying.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite file path. Local default `./data/app.db`; Docker uses `/data/app.db`. |
| `APP_SECRET` | Encrypts the OpenRouter API key stored in the database. If you change it, re-enter the key in admin settings. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Used only to create the admin account on first start. Change the password later in admin settings. |
| `COOKIE_SECURE` | Set to `true` if you put the app behind HTTPS. Leave unset for plain HTTP on the LAN. |

The OpenRouter API key and the models used for sentence writing and the helper chat are set in the admin UI, not in
env files.

## Backups

Everything is in one SQLite database (plus its `-wal` file while running). To back up safely while the app runs:

```bash
sqlite3 data/app.db ".backup 'backup-$(date +%F).db'"
```

Or stop the container (`docker compose stop`), copy `data/app.db`, and start it again. To restore, stop the app and
replace `data/app.db` with the backup.

## How it works

- **Books and chapters** are defined in `src/content/books.ts`. Each chapter lists the labels students tag and the rules
  the sentence writer must follow. Add a book by adding an entry there.
- **Sentence generation** (`src/lib/ai/`): the AI returns a sentence plus labeled spans as JSON. The server tokenizes
  the sentence itself, maps each span onto word positions, and checks the key (for example, the simple subject must be
  inside the complete subject). Bad keys are retried up to 3 times. The answer key never goes to the browser until the
  student asks to see it.
- **Grading** (`src/lib/grading.ts`) is word by word per label. Extra tagged words count against the score, so tagging
  everything doesn't pay off. Progress uses each sentence's first try.
- **Mastery**: a chapter is mastered when the student has done at least 10 sentences and the average first-try score of
  the last 10 is 80% or higher.
- **Time tracking** counts only time the practice tab is visible and the student has interacted in the last 90 seconds.
- **Helper chat** gets the sentence and the hidden answer key with instructions to coach, not tell. Students are limited
  to 20 questions per 10 minutes. Chats are saved and visible to the admin on each student's page.
- **Problem reports**: students can flag a sentence whose answer looks wrong; they show up under Admin > Problem reports.
