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
import { CAPABILITIES, RESEARCH_PATH, RESEARCH_TITLE } from "@/features/research/capabilities";
import { CapabilityPage, ResearchLayout, ResearchOverviewPage } from "@/features/research/ResearchPages";
import { NEW_PROJECT_PATH, PROJECTS_PATH } from "@/features/research/projects/paths";
import { DatasetCatalogPage, DatasetDetailsPage } from "@/features/research/datasets/DatasetPages";
import { DATASETS_PATH } from "@/features/research/datasets/datasetText";
import { EditProjectPage, NewProjectPage, ProjectDetailsPage, ProjectsPage } from "@/features/research/projects/ProjectPages";
import { FireStoryPage } from "@/features/story/FireStoryPage";
import { GUIDE_PATH, HOW_PATH, NAV_ITEMS, PLACES_PATH, PLACES_TITLE, PLANNED_PATH } from "./nav";

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
  // No longer in the menus, but still a working page (Phase A of retiring it from the main navigation).
  { path: PLACES_PATH, element: <MyPlacesPage />, handle: { title: PLACES_TITLE } },
  {
    path: RESEARCH_PATH,
    element: <ResearchLayout />,
    children: [
      { index: true, element: <ResearchOverviewPage />, handle: { title: title(RESEARCH_PATH) } },
      // Research projects work since R2 (this browser only); the other tools have a description page each.
      { path: PROJECTS_PATH, element: <ProjectsPage />, handle: { title: `Research projects · ${RESEARCH_TITLE}` } },
      { path: NEW_PROJECT_PATH, element: <NewProjectPage />, handle: { title: `New research project · ${RESEARCH_TITLE}` } },
      // Project pages set their own title (the project's name).
      { path: `${PROJECTS_PATH}/:projectId`, element: <ProjectDetailsPage />, handle: { title: "Research project" } },
      { path: `${PROJECTS_PATH}/:projectId/edit`, element: <EditProjectPage />, handle: { title: "Edit research project" } },
      // Datasets work since R3 (catalog; project links in this browser).
      { path: DATASETS_PATH, element: <DatasetCatalogPage />, handle: { title: `Datasets · ${RESEARCH_TITLE}` } },
      // Dataset pages set their own title (the dataset's name).
      { path: `${DATASETS_PATH}/:datasetId`, element: <DatasetDetailsPage />, handle: { title: "Dataset" } },
      ...CAPABILITIES.filter((c) => c.status !== "browser").map((c) => ({
        path: c.path,
        element: <CapabilityPage id={c.id} />,
        handle: { title: `${c.title} · ${RESEARCH_TITLE}` },
      })),
    ],
  },
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
