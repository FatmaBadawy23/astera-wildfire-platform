import { cn } from "@/lib/utils";

/**
 * The Astera badge. The source file is a JPG with a dark square background and no transparency,
 * so it is always shown in a circular crop that follows the badge edge (D.1 §6). The file is never modified.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-block shrink-0 overflow-hidden rounded-full bg-[#070E21]", className)}
      style={{ width: size, height: size }}
    >
      <img
        src="/astera-logo.jpg"
        alt=""
        aria-hidden="true"
        draggable={false}
        // The badge spans ~64% of the image width; scale so its edge meets the circular crop.
        style={{ width: "156%", height: "156%", maxWidth: "none", marginLeft: "-28%", marginTop: "-28%" }}
      />
    </span>
  );
}

export function LogoLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark size={compact ? 32 : 44} />
      <span className="flex flex-col leading-tight">
        <span className={cn("font-wordmark font-bold text-foreground", compact ? "text-sm" : "text-lg")}>Astera Watch</span>
        {!compact && (
          <span className="text-xs text-muted-foreground">Wildfire Surface-Change Monitoring with NASA NISAR Radar</span>
        )}
      </span>
    </span>
  );
}
