import { useNavigate } from "react-router-dom";
import { Button, Card } from "../components/ui";

export function ModuleHomePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-medium tracking-tight">PV Design</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Choose a module. Each module has its own plants — they are independent and do not share
          a project home.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-accent">Module</div>
          <h2 className="mt-2 text-xl font-medium">Layout configuration</h2>
          <p className="mt-2 flex-1 text-[13px] text-muted">
            Plants for placing table fields, string boxes, and the ITS. Optional catalog, BT/MV
            import, conceptual BOM, and plant layout live inside these plants.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate("/layout-config")}>
              Open plants
            </Button>
          </div>
        </Card>
        <Card className="flex flex-col p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-accent">Module</div>
          <h2 className="mt-2 text-xl font-medium">ITS Design</h2>
          <p className="mt-2 flex-1 text-[13px] text-muted">
            Separate plants for asset specs and strings → string box → ITS grouping, with orphan
            and overload checks.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate("/its")}>
              Open plants
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
