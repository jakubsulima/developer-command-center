import { Navigate, Route, Routes } from "react-router-dom";
import { InboxPage } from "../pages/InboxPage";
import { KnowledgePage } from "../pages/KnowledgePage";
import { GoalsPage } from "../pages/GoalsPage";
import { GoalDetailPage } from "../pages/GoalDetailPage";
import { TodayPage } from "../pages/TodayPage";
import { LegacyFocusHistoryPage } from "../pages/LegacyFocusHistoryPage";
import { KnowledgeDetailPage } from "../pages/KnowledgeDetailPage";
import { ActionFeedbackProvider } from "../components/ActionFeedback";
import { ActionDetailPage } from "../pages/ActionDetailPage";
import { RoutinesPage } from "../pages/RoutinesPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { ProjectDetailPage } from "../pages/ProjectDetailPage";
import { ReviewPage } from "../pages/ReviewPage";
import { ScrollToTop } from "../components/ScrollToTop";

export function App() {
  return (
    <ActionFeedbackProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/focus" element={<Navigate to="/" replace />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/:goalId" element={<GoalDetailPage />} />
        <Route path="/actions/:actionId" element={<ActionDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/learning" element={<Navigate to="/goals?kind=learning" replace />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/:knowledgeId" element={<KnowledgeDetailPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/history/focus/:sessionId" element={<LegacyFocusHistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ActionFeedbackProvider>
  );
}
