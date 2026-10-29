import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSession, hasAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const sp = await searchParams;
  const role = sp.role === "admin" ? "admin" : "viewer";
  const next = typeof sp.next === "string" ? sp.next : "";

  const session = await getSession();
  if (session && hasAccess(session.role, role)) redirect(role === "admin" ? "/admin" : "/streamer");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoginForm role={role} next={next} />
    </div>
  );
}
