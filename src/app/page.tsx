import SubmitForm from "@/components/SubmitForm";

export default function SubmitPage() {
  return (
    <section className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Submit Your Room</h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Upload up to 5 photos of your room. <br /> Submissions are kept strictly private.
        </p>
      </div>
      <div className="bg-twitch-card p-6 sm:p-8 rounded-2xl border border-twitch-border shadow-2xl space-y-6">
        <SubmitForm />
      </div>
    </section>
  );
}
