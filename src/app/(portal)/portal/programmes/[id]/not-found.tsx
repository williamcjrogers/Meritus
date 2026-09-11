import Link from "next/link";

export default function ProgrammeNotFound() {
  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-3xl text-green">Programme not found</h1>
      <p className="mt-3 text-[14px] text-ink/70">That programme is not on the desk.</p>
      <Link href="/portal/programmes" className="btn-quiet mt-6 inline-block">
        <span aria-hidden="true">←</span> Programmes
      </Link>
    </div>
  );
}
