import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { CaseInbox } from "./pages/CaseInbox";
import { ComparisonStudio } from "./pages/ComparisonStudio";
import { PensumManager } from "./pages/PensumManager";
import { NewCaseSetup } from "./pages/NewCaseSetup";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, element: <Navigate to="/casos" replace /> },
      { path: "casos", Component: CaseInbox },
      { path: "casos/nuevo", Component: NewCaseSetup },
      { path: "casos/:id", Component: ComparisonStudio },
      { path: "carreras", Component: PensumManager },
      { path: "reportes", element: <div className="p-8 text-slate-500">Reportes (Próximamente)</div> },
      { path: "*", element: <Navigate to="/casos" replace /> },
    ],
  },
]);
