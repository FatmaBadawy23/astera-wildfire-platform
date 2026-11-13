import { Navigate, Outlet, createBrowserRouter, useLocation, type RouteObject } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useDocumentTitle, useRouteFocus } from "@/components/layout/useRouteFocus";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { RouteErrorPage } from "@/features/errors/RouteErrorPage";
import { SciencePreview } from "@/features/dev/SciencePreview";
import { ExplorerPage } from "@/features/explorer/ExplorerPage";
import { FoundationPreview } from "@/features/foundation/FoundationPreview";
import { UserGuidePage } from "@/features/guide/UserGuidePage";
import { HowItWorksPage } from "@/features/guide/HowItWorksPage";
import { FireHistoryPage } from "@/features/history/FireHistoryPage";
import { MyPlacesPage } from "@/features/places/MyPlacesPage";
import { PlannedFeaturesPage } from "@/features/planned/PlannedPages";
import { FireStoryPage } from "@/features/story/FireStoryPage";
import { GUIDE_PATH, HOW_PATH, NAV_ITEMS, PLANNED_PATH } from "./nav";

/** Root route: browser tab title + focus management for every page. */
function RootLayout() {
  useDocumentTitle();
  useRouteFocus();
  return <Outlet />;
}

/** Old Explorer links (bookmarks, shared URLs) keep working: same filters, new address. */
function ExplorerRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/", search, hash }} replace />;
}

const title = (path: string) => NAV_ITEMS.find((i) => i.path === path)!.title;

/** App Shell pages (header, Help panel, demo bar in mock mode). */
const shellChildren: RouteObject[] = [
  // The Fire map is the homepage.
  { path: "/", element: <ExplorerPage />, handle: { title: title("/") } },
  { path: "/history", element: <FireHistoryPage />, handle: { title: title("/history") } },
  { path: "/places", element: <MyPlacesPage />, handle: { title: title("/places") } },
  // The Fire Story sets its own title (the possible fire's name).
  { path: "/events/:eventId", element: <FireStoryPage />, handle: { title: "Fire Story" } },
  { path: GUIDE_PATH, element: <UserGuidePage />, handle: { title: "User Guide" } },
  { path: HOW_PATH, element: <HowItWorksPage />, handle: { title: "How It Works" } },
  { path: PLANNED_PATH, element: <PlannedFeaturesPage />, handle: { title: "What's planned" } },
  // Development only: F3 science component gallery (excluded from production builds).
  ...(import.meta.env.DEV ? [{ path: "/dev/science", element: <SciencePreview />, handle: { title: "Science components (development)" } }] : []),
];

/**
 * Addresses from the earlier structure. Event details, data availability, SAR analysis and reports are now parts
 * of each Fire Story; the methodology page is How It Works; the assistant lives in Help (Ask). Accounts don't exist,
 * so the login and registration addresses lead to the Fire map.
 */
const redirects: RouteObject[] = [
  { path: "/explorer", element: <ExplorerRedirect /> },
  { path: "/events", element: <Navigate to="/history" replace /> },
  { path: "/availability", element: <Navigate to="/history" replace /> },
  { path: "/analysis", element: <Navigate to="/history" replace /> },
  { path: "/reports", element: <Navigate to="/history" replace /> },
  { path: "/methodology", element: <Navigate to={HOW_PATH} replace /> },
  { path: "/assistant", element: <Navigate to={`${GUIDE_PATH}#ask`} replace /> },
  { path: "/login", element: <Navigate to="/" replace /> },
  { path: "/register", element: <Navigate to="/" replace /> },
];

const devRoutes: RouteObject[] = import.meta.env.DEV ? [{ path: "/dev/foundation", element: <FoundationPreview />, handle: { title: "Foundation preview" } }] : [];

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      ...redirects,
      { element: <AppShell />, children: shellChildren },
      ...devRoutes,
      { path: "*", element: <NotFoundPage />, handle: { title: "Page not found" } },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
