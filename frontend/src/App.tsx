import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { FoundationPreview } from "@/features/foundation/FoundationPreview";

export function App() {
  return (
    <ThemeProvider>
      <FoundationPreview />
    </ThemeProvider>
  );
}
