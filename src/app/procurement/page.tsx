import ModuleManager, { type ModuleSection } from "@/components/module-manager";

const statuses = ["draft", "submitted", "approved", "rejected", "cancelled"];

const sections: ModuleSection[] = [
  {
    key: "suppliers",
    title: "Suppliers",
    description: "Maintain the supplier catalogue and contact details.",
    endpoint: "/api/modules/suppliers",
    fields: [
      { name: "name", label: "Supplier name", required: true },
      { name: "contactName", label: "Contact person" },
      { name: "email", label: "Email" },
      { name: "phone", label: "Phone", format: "phone" },
      { name: "address", label: "Address" },
    ],
    columns: [
      { key: "name", label: "Supplier" }, { key: "contactName", label: "Contact" },
      { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
    ],
  },
  {
    key: "purchase-requests",
    title: "Purchase requests",
    description: "Capture what the project needs and move requests through approval.",
    endpoint: "/api/modules/purchase-requests",
    fields: [
      { name: "requestNumber", label: "Request number", required: true, placeholder: "PR-1001" },
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name" },
      { name: "requiredBy", label: "Required by", type: "date" },
      { name: "justification", label: "Justification" },
      { name: "status", label: "Status", type: "select", options: statuses },
    ],
    columns: [
      { key: "requestNumber", label: "Request" }, { key: "projectName", label: "Project" },
      { key: "requesterName", label: "Requested by" }, { key: "requiredBy", label: "Required by" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "purchase-orders",
    title: "Purchase orders",
    description: "Issue orders to suppliers against approved requests.",
    endpoint: "/api/modules/purchase-orders",
    fields: [
      { name: "orderNumber", label: "Order number", required: true, placeholder: "PO-1001" },
      { name: "supplierId", label: "Supplier", type: "select", optionsFrom: "/api/modules/suppliers", optionLabel: "name", required: true },
      { name: "requestId", label: "Purchase request", type: "select", optionsFrom: "/api/modules/purchase-requests", optionLabel: "requestNumber" },
      { name: "projectId", label: "Project", type: "select", optionsFrom: "/api/modules/projects", optionLabel: "name" },
      { name: "orderedAt", label: "Ordered on", type: "date" },
      { name: "total", label: "Order total", type: "number" },
      { name: "currency", label: "Currency", placeholder: "ETB" },
      { name: "status", label: "Status", type: "select", options: statuses },
    ],
    columns: [
      { key: "orderNumber", label: "Order" }, { key: "supplierName", label: "Supplier" },
      { key: "projectName", label: "Project" }, { key: "total", label: "Total" },
      { key: "orderedAt", label: "Ordered on" }, { key: "status", label: "Status" },
    ],
  },
  {
    key: "material-receipts",
    title: "Received materials",
    description: "Record delivered materials; quantities update the live stock summary immediately.",
    endpoint: "/api/modules/material-receipts",
    fields: [
      { name: "materialId", label: "Material", type: "select", optionsFrom: "/api/modules/materials", optionLabel: "name", required: true },
      { name: "quantity", label: "Quantity received", type: "number", required: true },
      { name: "unitCost", label: "Unit cost", type: "number" },
      { name: "siteId", label: "Delivery site", type: "select", optionsFrom: "/api/modules/sites", optionLabel: "name" },
      { name: "referenceId", label: "Purchase order", type: "select", optionsFrom: "/api/modules/purchase-orders", optionLabel: "orderNumber" },
      { name: "occurredAt", label: "Received at", type: "datetime-local" },
      { name: "notes", label: "Notes" },
    ],
    columns: [
      { key: "materialName", label: "Material" }, { key: "orderNumber", label: "Order" },
      { key: "quantity", label: "Quantity" }, { key: "unitCost", label: "Unit cost" },
      { key: "lineTotal", label: "Line total" }, { key: "occurredAt", label: "Received at" },
    ],
  },
];

export default function ProcurementPage() {
  return (
    <ModuleManager
      title="Procurement"
      subtitle="Requests, suppliers, purchase orders and received materials in one workflow."
      sections={sections}
    />
  );
}
