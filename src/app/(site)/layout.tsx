import AppHeader from "@/components/AppHeader";
import { getSession } from "@/lib/session";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <>
      <AppHeader session={session} />
      <main className="shell flex-grow pt-6 pb-16 sm:pt-8">{children}</main>
    </>
  );
}
