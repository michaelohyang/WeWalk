import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AuthPage mode="signup" searchParams={props.searchParams} />;
}
