import styles from "./loading.module.css";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p>Loading…</p>
    </main>
  );
}
