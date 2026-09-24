import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppChrome } from "./components/AppChrome";
import { AppShell } from "./components/AppShell";
import { ConceptualPage } from "./pages/ConceptualPage";
import { ConfigPage } from "./pages/ConfigPage";
import { ItsAssetsPage } from "./pages/ItsAssetsPage";
import { ItsLayoutPage } from "./pages/ItsLayoutPage";
import { ItsWorkspace } from "./pages/ItsWorkspace";
import { LayoutPage } from "./pages/LayoutPage";
import { ProjectHomePage } from "./pages/ProjectHomePage";
import { ProjectsPage } from "./pages/ProjectsPage";

export default function App() {
  return (
    <BrowserRouter basename="/pv">
      <Routes>
        <Route element={<AppChrome />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<AppShell />}>
            <Route index element={<ProjectHomePage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="conceptual" element={<ConceptualPage />} />
            <Route path="layout" element={<LayoutPage />} />
            <Route path="its" element={<ItsWorkspace />}>
              <Route path=":blockId" element={<Navigate to="assets" replace />} />
              <Route path=":blockId/assets" element={<ItsAssetsPage />} />
              <Route path=":blockId/layout" element={<ItsLayoutPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
