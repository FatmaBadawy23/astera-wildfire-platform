import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchCountries, type CountryOption } from "@/data/countryIndex";
import { cn } from "@/lib/utils";

const control =
  "h-11 w-full rounded-md border border-border-strong bg-surface pr-10 pl-9 text-sm text-foreground placeholder:text-muted-foreground";

/**
 * Country search (ARIA 1.2 combobox with a listbox popup). Type to filter; ↑/↓ move through the suggestions,
 * Enter picks, Esc closes the list (or clears the text when it is already closed). Country level only.
 * `selected` shows the chosen country as the text; `onClear` (optional) adds a Clear button.
 */
export function CountrySearch({
  index,
  selected,
  onSelect,
  onClear,
  label = "Search for a country",
  hint,
  dataLabel = "in the data",
  className,
}: {
  index: CountryOption[];
  selected?: CountryOption | null;
  onSelect: (country: CountryOption) => void;
  onClear?: () => void;
  label?: string;
  hint?: string;
  /** Short note shown next to countries that have records. */
  dataLabel?: string;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const shown = text ?? selected?.name ?? "";
  const options = useMemo(() => (open ? searchCountries(index, text ?? "") : []), [open, index, text]);
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const expanded = open && options.length > 0;
  const noMatch = open && (text ?? "").trim() !== "" && options.length === 0;

  function pick(c: CountryOption) {
    onSelect(c);
    setText(null);
    setOpen(false);
  }

  return (
    <div className={cn("grid content-start gap-1", className)}>
      <label htmlFor={`${id}-input`} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded ? `${id}-opt-${active}` : undefined}
          aria-describedby={hint ? hintId : undefined}
          placeholder="Country name, e.g. Portugal"
          className={control}
          value={shown}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) setOpen(true);
              else setActive((a) => (options.length ? (a + 1) % options.length : 0));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (options.length ? (a - 1 + options.length) % options.length : 0));
            } else if (e.key === "Enter") {
              if (expanded && options[active]) {
                e.preventDefault();
                pick(options[active]);
              } else e.preventDefault();
            } else if (e.key === "Escape") {
              if (expanded) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              } else if (text) {
                e.preventDefault();
                setText(null);
              }
            }
          }}
        />
        {onClear && (selected || text) && (
          <button
            type="button"
            aria-label={selected ? `Clear country (${selected.name})` : "Clear search text"}
            onClick={() => {
              setText(null);
              if (selected) onClear();
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-1 inline-grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!expanded}
          className="absolute top-full right-0 left-0 z-[var(--aw-z-overlay)] mt-1 max-h-72 overflow-y-auto rounded-md border border-border-strong bg-surface p-1 shadow-lg"
        >
          {options.map((c, i) => (
            <li
              key={c.iso3}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              data-country-option={c.iso3}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c)}
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-sm px-2.5 text-sm",
                i === active && "bg-surface-raised outline-2 -outline-offset-2 outline-[var(--aw-color-focus-ring)] outline-solid",
              )}
            >
              <span>{c.name}</span>
              {c.hasData && <span className="text-xs text-muted-foreground">{dataLabel}</span>}
            </li>
          ))}
        </ul>
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {noMatch ? "No country matches. Only country names can be searched." : expanded ? `${options.length} suggestions.` : ""}
      </p>
      {noMatch && <p className="text-xs text-muted-foreground">No country matches. Only country names can be searched, not towns or addresses.</p>}
    </div>
  );
}
