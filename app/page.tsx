import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="ledger-rule" />
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[color:var(--muted)]">
          ○ Signed in
        </p>
        <h1 className="mt-4 font-mono text-2xl font-bold tracking-tight">bradley-os</h1>
        <p className="mt-4 font-serif text-base leading-7 text-[color:var(--muted)]">
          – Welcome, {session?.user?.name ?? session?.user?.email}.
        </p>

        <Link href="/inbox" className="ink-action mt-8 inline-block">
          • Open inbox digest
        </Link>

        <form
          className="mt-3"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button type="submit" className="ink-action">
            ✕ Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
