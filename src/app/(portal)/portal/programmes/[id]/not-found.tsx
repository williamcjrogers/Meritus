import Link from "next/link";

export default function ProgrammeNotFound() {
  return (
    <div className="max-w-xl">
      <h1 className="font-sans text-3xl text-primary">Programme not found</h1>
      <p className="mt-3 text-[15px] text-muted">That programme is not on the desk.</p>
      <Link href="/portal/programmes" className="btn-quiet mt-6 inline-block">
        <span aria-hidden="true">←</span> Programmes
      </Link>
    </div>
  );
}
