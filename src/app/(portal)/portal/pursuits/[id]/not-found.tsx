import Link from "next/link";

export default function PursuitNotFound() {
  return (
    <div className="max-w-2xl">
      <p className="portal-eyebrow">Live lead</p>
      <h1 className="mt-2 font-sans text-3xl text-primary">Not found</h1>
      <p className="mt-3 text-[15px] text-muted">This live lead does not exist or has been deleted.</p>
      <Link href="/portal/pursuits" className="btn-secondary mt-6">
        Back to live leads
      </Link>
    </div>
  );
}
