"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleManager, { type ModuleSection } from "@/components/module-manager";
import { fetchJson } from "@/lib/client-api";

const sections: ModuleSection[] = [
  {
    key: "materials",
    title: "Materials",
    description: "Maintain the material catalogue and minimum stock levels.",
    endpoint: "/api/modules/materials",
    fields: [
      { name: "sku", label: "SKU", required: true },
      { name: "name", label: "Material name", required: true },
      { name: "unit", label: "Unit", required: true, placeholder: "bag, kg, pcs" },
      { name: "minimumStock", label: "Minimum stock", type: "number" },
    ],
    columns: [
      { key: "sku", label: "SKU" }, { key: "name", label: "Material" },
      { key: "unit", label: "Unit" }, { key: "minimumStock", label: "Min stock" },
    ],
  },
  {
    key: "inventory-transactions",
    title: "Inventory movements",
    description: "Record received, issued, returned, transferred and adjusted materials.",
    endpoint: "/api/modules/inventory-transactions",
    fields: [
      { name: "materialId", label: "Material", type: "select", optionsFrom: "/api/modules/materials", optionLabel: "name", required: true },
      { name: "movement", label: "Movement", type: "select", options: ["receipt", "issue", "return", "transfer_in", "transfer_out", "adjustment", "wastage"], required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true },
      { name: "unitCost", label: "Unit cost" },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "materialId", label: "Material ID" }, { key: "movement", label: "Movement" },
      { key: "quantity", label: "Quantity" }, { key: "unitCost", label: "Unit cost" },
      { key: "occurredAt", label: "Occurred at" },
    ],
  },
  {
    key: "equipment",
    title: "Equipment",
    description: "Keep a register of equipment available across sites.",
    endpoint: "/api/modules/equipment",
    fields: [
      { name: "equipmentNumber", label: "Equipment number", required: true },
      { name: "name", label: "Equipment name", required: true },
      { name: "equipmentType", label: "Type" },
    ],
    columns: [
      { key: "equipmentNumber", label: "Number" }, { key: "name", label: "Equipment" },
      { key: "equipmentType", label: "Type" }, { key: "status", label: "Status" },
    ],
  },
  {
    key: "equipment-usage",
    title: "Equipment usage",
    description: "Log daily operating hours and fuel consumption.",
    endpoint: "/api/modules/equipment-usage",
    fields: [
      { name: "equipmentId", label: "Equipment", type: "select", optionsFrom: "/api/modules/equipment", optionLabel: "name", required: true },
      { name: "usageDate", label: "Usage date", type: "date", required: true },
      { name: "workingHours", label: "Working hours", type: "number" },
      { name: "fuelLiters", label: "Fuel (litres)", type: "number" },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "equipmentId", label: "Equipment ID" }, { key: "usageDate", label: "Date" },
      { key: "workingHours", label: "Hours" }, { key: "fuelLiters", label: "Fuel" },
      { key: "notes", label: "Notes" },
    ],
  },
];

type Material = { id: number; sku: string; name: string; unit: string; minimumStock: string | number | null };
type Tx = { materialId: number; movement: string; quantity: string | number };

function StockSummary() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [m, t] = await Promise.all([
        fetchJson<Material[]>("/api/modules/materials"),
        fetchJson<Tx[]>("/api/modules/inventory-transactions"),
      ]);
      setMaterials(m);
      setTxs(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stock could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => materials.map((m) => {
    let received = 0, issued = 0, adjusted = 0;
    for (const t of txs.filter((x) => x.materialId === m.id)) {
      const q = Number(t.quantity) || 0;
      if (["receipt", "return", "transfer_in"].includes(t.movement)) received += q;
      else if (["issue", "transfer_out", "wastage"].includes(t.movement)) issued += q;
      else if (t.movement === "adjustment") adjusted += q;
    }
    const remaining = received - issued + adjusted;
    return { ...m, received, issued, adjusted, remaining };
  }), [materials, txs]);

  return (
    <section className="management-card" style={{ marginTop: 16 }}>
      <div className="management-card-heading" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2>Material stock summary</h2>
          <p>Received, issued, adjusted and remaining quantities by material.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void load()}>Refresh stock</button>
      </div>
      {error && <div className="management-message error-message" role="alert">{error}</div>}
      <div className="management-table-wrap">
        <table className="management-table">
          <thead><tr><th scope="col">Material</th><th scope="col">SKU</th><th scope="col">Received</th><th scope="col">Issued</th><th scope="col">Adjusted</th><th scope="col">Remaining</th><th scope="col">Unit</th><th scope="col">Min stock</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td><td>{r.sku}</td><td>{r.received}</td><td>{r.issued}</td><td>{r.adjusted}</td>
                <td><strong>{r.remaining}</strong></td><td>{r.unit}</td><td>{r.minimumStock ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="management-empty" colSpan={8}>No materials yet. Add materials and inventory movements to see stock.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MaterialsPage() {
  return (
    <>
      <ModuleManager
        title="Materials & equipment"
        subtitle="Catalogue materials, record received/issued movements, monitor remaining stock, and track equipment use."
        sections={sections}
      />
      <div className="management-main" style={{ paddingTop: 0 }}>
        <StockSummary />
      </div>
    </>
  );
}
