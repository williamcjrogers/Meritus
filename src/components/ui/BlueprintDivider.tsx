export function BlueprintDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full flex justify-center py-[clamp(2rem,4vw,4rem)] ${className}`} aria-hidden="true">
      <div className="flex items-center w-full max-w-[1200px] px-6 lg:px-[8%]">
        <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent to-brass/30" />
        <div className="px-6 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 border border-brass/40 rotate-45" />
          <div className="w-1.5 h-1.5 bg-brass/40 rotate-45" />
          <div className="w-1.5 h-1.5 border border-brass/40 rotate-45" />
        </div>
        <div className="h-[1px] flex-grow bg-gradient-to-l from-transparent to-brass/30" />
      </div>
    </div>
  );
}
