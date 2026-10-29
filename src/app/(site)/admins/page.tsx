import type { Metadata } from "next";
import { requireSiteAdminPage } from "@/lib/session";
import { listAdmins, OTP_HOURS } from "@/lib/accounts";
import { getT } from "@/i18n/server";
import AdminsManager from "@/components/AdminsManager";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).admins.title, robots: { index: false } };
}

export default async function AdminsPage() {
  const me = await requireSiteAdminPage("/admins");
  const admins = await listAdmins();
  return <AdminsManager admins={admins} meId={me.id} otpHours={OTP_HOURS} />;
}
