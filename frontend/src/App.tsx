import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppChrome } from "./components/AppChrome";
import { AppShell } from "./components/AppShell";
import { ConceptualPage } from "./pages/ConceptualPage";
import { ConfigPage } from "./pages/ConfigPage";
import { ItsAssetsPage } from "./pages/ItsAssetsPage";
import { ItsGroupingPage } from "./pages/ItsGroupingPage";
import { ItsLayoutPage } from "./pages/ItsLayoutPage";
import { ItsWorkspace, LayoutConfigWorkspace } from "./pages/ItsWorkspace";
import { LayoutPage } from "./pages/LayoutPage";
import { ProjectHomePage } from "./pages/ProjectHomePage";
import { ProjectsPage } from "./pages/ProjectsPage";

function RedirectItsLayout() {
  const { id, blockId } = useParams();
  return <Navigate to={`/projects/${id}/layout-config/${blockId}`} replace />;
}

function RedirectPlant({ to }: { to: "config" | "conceptual" | "layout" }) {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/plant/${to}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter basename="/pv">
      <Routes>
        <Route element={<AppChrome />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<AppShell />}>
            <Route index element={<ProjectHomePage />} />
            <Route path="layout-config" element={<LayoutConfigWorkspace />}>
              <Route path=":blockId" element={<ItsLayoutPage />} />
            </Route>
            <Route path="its" element={<ItsWorkspace />}>
              <Route path=":blockId" element={<Navigate to="assets" replace />} />
              <Route path=":blockId/assets" element={<ItsAssetsPage />} />
              <Route path=":blockId/grouping" element={<ItsGroupingPage />} />
              <Route path=":blockId/layout" element={<RedirectItsLayout />} />
            </Route>
            <Route path="plant/config" element={<ConfigPage />} />
            <Route path="plant/conceptual" element={<ConceptualPage />} />
            <Route path="plant/layout" element={<LayoutPage />} />
            <Route path="config" element={<RedirectPlant to="config" />} />
            <Route path="conceptual" element={<RedirectPlant to="conceptual" />} />
            <Route path="layout" element={<RedirectPlant to="layout" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
