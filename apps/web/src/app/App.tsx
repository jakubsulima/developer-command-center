import { Route, Routes } from "react-router-dom";
import { CommandPage } from "../pages/CommandPage";
import { FocusPage } from "../pages/FocusPage";
import { InboxPage } from "../pages/InboxPage";
import { KnowledgePage } from "../pages/KnowledgePage";
import { LearningPage } from "../pages/LearningPage";
import { ProjectDetailPage } from "../pages/ProjectDetailPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ReviewPage } from "../pages/ReviewPage";
import { ActionFeedbackProvider } from "../components/ActionFeedback";

export function App() {
  return (
    <ActionFeedbackProvider>
      <Routes>
        <Route path="/" element={<CommandPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="*" element={<CommandPage />} />
      </Routes>
    </ActionFeedbackProvider>
  );
}
