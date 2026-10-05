import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AuthPage mode="login" searchParams={props.searchParams} />;
}
