import { createBrowserRouter } from "react-router";
import { WorkflowEditor } from "./components/WorkflowEditor";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: WorkflowEditor,
  },
]);
