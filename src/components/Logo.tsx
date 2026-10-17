import logoImg from "@/assets/logo.jpg";

interface LogoProps {
  light?: boolean;
  className?: string;
  imgClassName?: string;
  showText?: boolean;
}

export function Logo({
  light = false,
  className = "",
  imgClassName = "",
  showText = true,
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoImg}
        alt="Rural Tech Store"
        className={`h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-primary/20 shadow-sm ${imgClassName}`}
      />
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-display text-base font-bold leading-tight ${
              light ? "text-sidebar-foreground" : "text-primary"
            }`}
          >
            Rural Tech Store
          </span>
          <span
            className={`text-[11px] font-medium leading-none mt-0.5 ${
              light ? "text-sidebar-foreground/70" : "text-muted-foreground"
            }`}
          >
            Scheme Finder
          </span>
        </div>
      )}
    </div>
  );
}
