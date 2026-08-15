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
      <section className="w-full max-w-sm border border-[color:var(--border)] bg-[color:var(--background)] p-8">
        <p className="font-mono text-xs uppercase tracking-wider text-[color:var(--accent)]">
          Private workspace
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to bradley-os</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
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
          <button
            type="submit"
            className="w-full cursor-pointer border border-[color:var(--foreground)] px-4 py-3 text-sm font-medium transition-colors duration-150 hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
          >
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
