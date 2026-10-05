"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrors, request } from "@/client/api";
import styles from "@/ui/forms.module.css";

type Mode = "login" | "signup";

/**
 * Log in or sign up with a username and password. Used by /login, /signup and the signed-out
 * screen any page shows (so a shared link to a station opens that station after logging in).
 */
export function AuthForm({ mode: initial, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = "Enter your username.";
    if (!password) problems.password = "Enter your password.";
    else if (signup && password.length < 8) problems.password = "At least 8 characters.";
    setErrors(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    const res = await request("POST", signup ? "/api/signup" : "/api/login", { name, password });
    setBusy(false);
    if (res.ok) {
      if (next) router.replace(next);
      router.refresh();
      return;
    }
    const byField = fieldErrors(res.error);
    setErrors(Object.keys(byField).length ? byField : { form: res.error.message });
  }

  const switchTo = (to: Mode) => (e: React.MouseEvent) => {
    // Without a `next` (the signed-out screen), switch in place and keep the URL.
    if (next) return;
    e.preventDefault();
    setMode(to);
    setErrors({});
  };

  const field = (
    key: "name" | "password",
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        className={styles.input}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `auth-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <span id={`auth-${key}-error`} className={styles.error}>
          {errors[key]}
        </span>
      )}
    </label>
  );

  return (
    <form className={styles.card} onSubmit={submit} noValidate>
      <p className={styles.lede}>
        {signup
          ? "Pick a username your crew will recognize, and a password. That's the whole sign-up."
          : "Welcome back. The coffee's been judged in your absence."}
      </p>
      {field("name", "Username", {
        value: name,
        onChange: (e) => setName(e.target.value),
        maxLength: 30,
        autoComplete: "username",
        autoCapitalize: signup ? "words" : "none",
        placeholder: signup ? "Sal from accounting" : undefined,
        autoFocus: true,
      })}
      {field("password", "Password", {
        type: "password",
        value: password,
        onChange: (e) => setPassword(e.target.value),
        maxLength: 200,
        autoComplete: signup ? "new-password" : "current-password",
        placeholder: signup ? "8+ characters" : undefined,
      })}
      {errors.form && (
        <p className={styles.error} role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={busy}>
        {busy ? (signup ? "Signing up…" : "Logging in…") : signup ? "Sign up" : "Log in"}
      </button>
      <p className={styles.lede}>
        {signup ? "Already have an account? " : "New here? "}
        <Link
          href={signup ? "/login" : "/signup"}
          onClick={switchTo(signup ? "login" : "signup")}
          className={styles.inlineLink}
        >
          {signup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
