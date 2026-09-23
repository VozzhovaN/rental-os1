import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { clearSessionCookieFromJar, readSessionTokenFromNextCookies } from "@/lib/auth/cookies";
import { getValidSessionFromCookies } from "@/lib/auth/require-auth";

export default async function LoginPage() {
  const session = await getValidSessionFromCookies();
  if (session) {
    redirect("/crm/dashboard");
  }

  const stale = await readSessionTokenFromNextCookies();
  if (stale) {
    await clearSessionCookieFromJar();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">rental-os</h1>
        <p className="mt-1 text-sm text-zinc-600">Вход в CRM</p>
        <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Загрузка…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
