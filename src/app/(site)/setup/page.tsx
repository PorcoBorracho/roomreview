import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SetupForm from "@/components/SetupForm";
import { hasAnyAdmin } from "@/lib/accounts";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).setup.title, robots: { index: false } };
}

/** Solo existe mientras no haya ninguna cuenta. Después, redirige al login. */
export default async function SetupPage() {
  if (await hasAnyAdmin()) redirect("/login");
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <SetupForm />
    </div>
  );
}
