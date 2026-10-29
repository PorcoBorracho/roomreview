import SubmitForm from "@/components/SubmitForm";

export default function SubmitPage() {
  return (
    <section className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Submit your room</h2>
        <p className="mt-3 text-[15px] text-muted">
          Share up to 5 photos for a chance to be reviewed on stream. Submissions stay private until approved.
        </p>
      </header>
      <div className="rounded-2xl border border-line bg-card p-5 shadow-raised sm:p-8">
        <SubmitForm />
      </div>
    </section>
  );
}
