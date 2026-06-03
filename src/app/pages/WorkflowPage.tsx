import { WorkflowEditor } from '../workflow/WorkflowEditor';

// 2-sahifa: AI-Workflow (https://github.com/MarufAkhmatov/AI-Workflow).
// Komponentlar src/app/workflow/ ichida. WorkflowEditor o'z ichida
// absolute inset-0 ishlatadi, shuning uchun ota element relative + flex-1.
export default function WorkflowPage() {
  return (
    <div className="flex-1 relative overflow-hidden">
      <WorkflowEditor />
    </div>
  );
}
