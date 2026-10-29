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
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <LoginForm role={role} next={next} />
    </div>
  );
}
