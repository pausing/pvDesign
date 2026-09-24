import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppChrome } from "./components/AppChrome";
import { AppShell } from "./components/AppShell";
import { ConceptualPage } from "./pages/ConceptualPage";
import { ConfigPage } from "./pages/ConfigPage";
import { ItsAssetsPage } from "./pages/ItsAssetsPage";
import { ItsGroupingPage } from "./pages/ItsGroupingPage";
import { ItsLayoutPage } from "./pages/ItsLayoutPage";
import { ItsWorkspace, LayoutConfigWorkspace, RedirectLegacyProject } from "./pages/ItsWorkspace";
import { LayoutPage } from "./pages/LayoutPage";
import { ModuleHomePage } from "./pages/ModuleHomePage";
import { ModulePlantsPage } from "./pages/ModulePlantsPage";

function RedirectOldIts() {
  const { id } = useParams();
  return <Navigate to={`/its/${id}/assets`} replace />;
}

function RedirectOldLayout() {
  const { id } = useParams();
  return <Navigate to={`/layout-config/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter basename="/pv">
      <Routes>
        <Route element={<AppChrome />}>
          <Route path="/" element={<ModuleHomePage />} />
          <Route path="/layout-config" element={<ModulePlantsPage module="layout_config" />} />
          <Route path="/its" element={<ModulePlantsPage module="its_design" />} />
          <Route path="/layout-config/:id" element={<AppShell module="layout_config" />}>
            <Route element={<LayoutConfigWorkspace />}>
              <Route index element={<ItsLayoutPage />} />
            </Route>
            <Route path="tools/config" element={<ConfigPage />} />
            <Route path="tools/conceptual" element={<ConceptualPage />} />
            <Route path="tools/layout" element={<LayoutPage />} />
          </Route>
          <Route path="/its/:id" element={<AppShell module="its_design" />}>
            <Route element={<ItsWorkspace />}>
              <Route index element={<Navigate to="assets" replace />} />
              <Route path="assets" element={<ItsAssetsPage />} />
              <Route path="grouping" element={<ItsGroupingPage />} />
            </Route>
          </Route>
          <Route path="/projects/:id" element={<AppShell module="layout_config" />}>
            <Route index element={<RedirectLegacyProject />} />
            <Route path="layout-config/*" element={<RedirectOldLayout />} />
            <Route path="its/*" element={<RedirectOldIts />} />
            <Route path="config" element={<RedirectOldLayout />} />
            <Route path="conceptual" element={<RedirectOldLayout />} />
            <Route path="layout" element={<RedirectOldLayout />} />
            <Route path="plant/*" element={<RedirectOldLayout />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
