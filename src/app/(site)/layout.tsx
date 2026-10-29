import AppHeader from "@/components/AppHeader";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="shell flex-grow pt-6 pb-16 sm:pt-8">{children}</main>
    </>
  );
}
