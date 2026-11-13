import { Link } from "react-router";
import { APP_NAME } from "@/app/nav";
import { ProductMark } from "@/components/brand/Logo";
import { HeaderNav, HelpButton, HowItWorksLink } from "./PrimaryNav";
import { ThemeToggle } from "./ThemeToggle";

/**
 * 56px header row of the app frame (a grid row, never sticky/fixed, so it can't cover content).
 * 768 px and wider: logo, the three destinations, Help, theme (1024 px and wider also "How it works"). Phones: logo and theme (the tab bar has the rest).
 */
export function Header({ mobile, wide }: { mobile: boolean; wide: boolean }) {
  return (
    <header className="z-[var(--aw-z-header)] flex h-[var(--aw-size-header)] items-center gap-2 border-b border-border bg-surface px-3 sm:px-4 md:gap-4">
      <Link to="/" aria-label={`${APP_NAME}, go to the Fire map`} className="flex shrink-0 items-center gap-2.5 rounded-md p-1">
        <ProductMark size={32} />
        <span className="font-wordmark text-base font-bold text-foreground md:hidden lg:inline">{APP_NAME}</span>
      </Link>
      {!mobile && <HeaderNav />}
      <div className="ml-auto flex items-center gap-2">
        {wide && <HowItWorksLink />}
        {!mobile && <HelpButton />}
        <ThemeToggle />
      </div>
    </header>
  );
}
