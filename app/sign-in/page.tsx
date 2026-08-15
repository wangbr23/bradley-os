import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="ledger-rule" />
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[color:var(--muted)]">
          ○ Private workspace
        </p>
        <h1 className="mt-4 font-mono text-2xl font-bold tracking-tight">
          Sign in to bradley-os
        </h1>
        <p className="mt-4 font-serif text-base leading-7 text-[color:var(--muted)]">
          Continue with the single Google account authorized for this app.
        </p>

        <form
          className="mt-8"
          action={async () => {
            "use server";

            try {
              await signIn("google", { redirectTo: "/" });
            } catch (error) {
              if (error instanceof AuthError) {
                redirect("/sign-in?error=AccessDenied");
              }
              throw error;
            }
          }}
        >
          <button type="submit" className="ink-action">
            • Continue with Google
          </button>
        </form>

        <p className="mt-10 font-mono text-[11px] tracking-wide text-[color:var(--muted)]">
          · task &nbsp;&nbsp; ○ event &nbsp;&nbsp; – note
        </p>
      </div>
    </main>
  );
}
