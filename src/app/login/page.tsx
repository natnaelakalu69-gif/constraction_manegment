import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in | Construction Operations",
  description: "Sign in to the construction operations workspace.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page" />}>
      <LoginForm />
    </Suspense>
  );
}
