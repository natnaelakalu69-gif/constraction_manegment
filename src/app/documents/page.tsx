import ModuleManager, { type ModuleSection, type ModuleField } from "@/components/module-manager";

const documentFields: ModuleField[] = [
  { name: "title", label: "Document title", required: true },
  {
    name: "projectId",
    label: "Project",
    type: "select",
    optionsFrom: "/api/modules/projects",
    optionLabel: "name",
  },
  {
    name: "storageKey",
    label: "Storage key / link",
    required: true,
    placeholder: "documents/project-name/file.pdf",
  },
  { name: "mimeType", label: "MIME type", placeholder: "application/pdf" },
  { name: "sizeBytes", label: "Size (bytes)", type: "number" },
  { name: "version", label: "Version", type: "number" },
];

const documentColumns = [
  { key: "title", label: "Document" },
  { key: "projectName", label: "Project" },
  { key: "mimeType", label: "Type" },
  { key: "version", label: "Version" },
  { key: "storageKey", label: "Storage key" },
  { key: "uploadedByName", label: "Uploaded by" },
];

function documentSection(
  key: string,
  title: string,
  description: string,
  storagePlaceholder: string,
): ModuleSection {
  return {
    key,
    title,
    description,
    endpoint: `/api/modules/${key}`,
    fields: documentFields.map((field) =>
      field.name === "storageKey" ? { ...field, placeholder: storagePlaceholder } : field
    ),
    columns: documentColumns,
  };
}

const sections: ModuleSection[] = [
  documentSection(
    "contract-documents",
    "Contracts",
    "Signed agreements, subcontracts and contract amendments.",
    "documents/contracts/signed-agreement.pdf",
  ),
  documentSection(
    "project-documents",
    "Project documents",
    "General project records, method statements and correspondence.",
    "documents/projects/project-brief.pdf",
  ),
  documentSection(
    "drawings",
    "Drawings",
    "Issued drawings, revisions and design sheets.",
    "documents/drawings/rev-a-layout.pdf",
  ),
  documentSection(
    "permits",
    "Permits",
    "Work permits, approvals and site access authorisations.",
    "documents/permits/hot-work-permit.pdf",
  ),
  documentSection(
    "safety-documents",
    "Safety documents",
    "Risk assessments, safety plans, inspections and incident reports.",
    "documents/safety/risk-assessment.pdf",
  ),
  documentSection(
    "delivery-documents",
    "Delivery documents",
    "Delivery notes, GRNs and paperwork for received materials.",
    "documents/deliveries/grn-1001.pdf",
  ),
];

export default function DocumentsPage() {
  return (
    <ModuleManager
      title="Documents"
      subtitle="A controlled register for contracts, project files, drawings, permits, safety records and delivery paperwork."
      sections={sections}
    />
  );
}
