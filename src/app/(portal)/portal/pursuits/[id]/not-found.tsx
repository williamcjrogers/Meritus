import Link from "next/link";

export default function PursuitNotFound() {
  return (
    <div className="max-w-2xl">
      <p className="portal-eyebrow">Pursuit</p>
      <h1 className="mt-2 font-serif text-3xl text-green">Not found</h1>
      <p className="mt-3 text-[14px] text-ink/70">This pursuit does not exist or has been deleted.</p>
      <Link href="/portal" className="btn-secondary mt-6">
        Back to the desk
      </Link>
    </div>
  );
}
