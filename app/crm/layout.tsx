import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CrmShell } from "@/components/crm/crm-shell";
import { clearSessionCookieFromJar, readSessionTokenFromNextCookies } from "@/lib/auth/cookies";
import { getValidSessionFromCookies } from "@/lib/auth/require-auth";
import { isDemoMode } from "@/lib/demo/demo-mode";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const session = await getValidSessionFromCookies();
  if (!session) {
    const stale = await readSessionTokenFromNextCookies();
    if (stale) {
      await clearSessionCookieFromJar();
    }
    redirect("/login");
  }

  const user = session.user;

  return (
    <CrmShell email={user.email} name={user.name} demoMode={isDemoMode()}>
      {children}
    </CrmShell>
  );
}
