import Link from "next/link";
import styles from "./Button.module.css";

type Variant = "primary" | "dark" | "plain" | "light";

/** A pill-shaped link that looks like a button. */
export function ButtonLink({
  href,
  variant = "plain",
  size = "md",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${styles.btn} ${styles[variant]} ${styles[size]}`}>
      {children}
    </Link>
  );
}
