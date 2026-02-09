import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-green min-h-screen flex items-center justify-center">
      <div className="text-center px-6">
        <p className="font-mono text-[11px] tracking-[0.3em] text-brass mb-6">404</p>
        <h1 className="font-serif text-4xl text-cream italic">Page not found</h1>
        <p className="mt-6 text-[15px] text-cream/45">The page you are looking for does not exist.</p>
        <div className="mt-10">
          <Link href="/" className="text-[13px] text-brass tracking-wide border-b border-brass/40 pb-1 hover:border-brass transition-colors duration-300">Return to homepage</Link>
        </div>
      </div>
    </section>
  );
}
