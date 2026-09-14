import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppChrome } from "./components/AppChrome";
import { AppShell } from "./components/AppShell";
import { ConceptualPage } from "./pages/ConceptualPage";
import { ConfigPage } from "./pages/ConfigPage";
import { LayoutPage } from "./pages/LayoutPage";
import { ProjectsPage } from "./pages/ProjectsPage";

export default function App() {
  return (
    <BrowserRouter basename="/pv">
      <Routes>
        <Route element={<AppChrome />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<AppShell />}>
            <Route index element={<Navigate to="config" replace />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="conceptual" element={<ConceptualPage />} />
            <Route path="layout" element={<LayoutPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
