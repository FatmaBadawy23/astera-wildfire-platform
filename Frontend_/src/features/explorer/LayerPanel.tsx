import { Info, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LAYER_HELP, LAYER_ORDER, type LayerKey, type LayerVisibility } from "./layerHelp";

/** Explanation of one layer: what it shows and what it does NOT show. */
export function LayerInfo({ layer }: { layer: LayerKey }) {
  const help = LAYER_HELP[layer];
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`About the layer: ${help.label}`}
        className="inline-grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground"
      >
        <Info className="size-[18px]" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent aria-label={help.label} className="grid gap-2">
        <p className="font-heading text-base font-semibold">{help.label}</p>
        <p>
          <span className="font-semibold">Shows: </span>
          {help.shows}
        </p>
        <p>
          <span className="font-semibold">Does not show: </span>
          {help.doesNotShow}
        </p>
        {help.note && <p className="text-muted-foreground">{help.note}</p>}
      </PopoverContent>
    </Popover>
  );
}

/** Layer switches. Every layer has an explanation on demand (info button). */
export function LayerPanel({ layers, onChange }: { layers: LayerVisibility; onChange: (next: LayerVisibility) => void }) {
  return (
    <fieldset className="grid gap-0.5">
      <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Layers className="size-4" aria-hidden="true" />
        Map layers
      </legend>
      {LAYER_ORDER.map((key) => {
        const id = `layer-${key}`;
        return (
          <div key={key} className="flex min-h-9 items-center justify-between gap-1">
            <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={layers[key]}
                onChange={(e) => onChange({ ...layers, [key]: e.target.checked })}
                className="size-[18px] cursor-pointer accent-[var(--aw-color-primary)]"
              />
              {LAYER_HELP[key].label}
            </label>
            <LayerInfo layer={key} />
          </div>
        );
      })}
    </fieldset>
  );
}
