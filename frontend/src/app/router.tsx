import { Outlet, createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useDocumentTitle, useRouteFocus } from "@/components/layout/useRouteFocus";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { RouteErrorPage } from "@/features/errors/RouteErrorPage";
import { SciencePreview } from "@/features/dev/SciencePreview";
import { FoundationPreview } from "@/features/foundation/FoundationPreview";
import { PlaceholderPage } from "@/features/placeholders/PlaceholderPage";
import { WelcomePage } from "@/features/welcome/WelcomePage";
import { NAV_ITEMS } from "./nav";

/** Root route: browser tab title + focus management for every page. */
function RootLayout() {
  useDocumentTitle();
  useRouteFocus();
  return <Outlet />;
}

const eventsItem = NAV_ITEMS.find((i) => i.path === "/events")!;

/** App Shell pages (sidebar, header, MOCK banner in mock mode). */
const shellChildren: RouteObject[] = [
  ...NAV_ITEMS.map((item) => ({ path: item.path, element: <PlaceholderPage item={item} />, handle: { title: item.title } })),
  { path: "/events/:eventId", element: <PlaceholderPage item={eventsItem} />, handle: { title: eventsItem.title } },
  // Development only: F3 science component gallery (excluded from production builds).
  ...(import.meta.env.DEV
    ? [{ path: "/dev/science", element: <SciencePreview />, handle: { title: "Science components (development)" } }]
    : []),
];

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: "/dev/foundation", element: <FoundationPreview />, handle: { title: "Foundation preview" } }]
  : [];

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      // Standalone pages: no sidebar and no MOCK banner.
      { path: "/", element: <WelcomePage />, handle: { title: "Welcome" } },
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage />, handle: { title: "Log in" } },
          { path: "/register", element: <RegisterPage />, handle: { title: "Create account" } },
        ],
      },
      // App Shell.
      { element: <AppShell />, children: shellChildren },
      ...devRoutes,
      { path: "*", element: <NotFoundPage />, handle: { title: "Page not found" } },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
