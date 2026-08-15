import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import styles from "./page.module.css";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className="ledger-rule" />
        <p className={styles.eyebrow}>
          ○ Private workspace
        </p>
        <h1 className={styles.title}>
          Sign in to bradley-os
        </h1>
        <p className={styles.copy}>
          Continue with the single Google account authorized for this app.
        </p>

        <form
          className={styles.form}
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

        <p className={styles.legend}>
          · task &nbsp;&nbsp; ○ event &nbsp;&nbsp; – note
        </p>
      </div>
    </main>
  );
}
