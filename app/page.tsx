import { auth, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-[color:var(--muted)]">
        Signed in
      </p>
      <h1 className="text-2xl font-semibold">bradley-os</h1>
      <p className="max-w-sm text-sm text-[color:var(--muted)]">
        Welcome, {session?.user?.name ?? session?.user?.email}.
      </p>
      <form
        className="mt-5"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="cursor-pointer border border-[color:var(--border)] px-3 py-2 font-mono text-xs transition-colors duration-150 hover:border-[color:var(--foreground)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
