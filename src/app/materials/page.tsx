import ModuleManager, { type ModuleSection } from "@/components/module-manager";

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
    description: "Record receipts, issues, returns, transfers and adjustments.",
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

export default function MaterialsPage() {
  return (
    <ModuleManager
      title="Materials & equipment"
      subtitle="Catalogue materials, track stock movements and monitor equipment use."
      sections={sections}
    />
  );
}
