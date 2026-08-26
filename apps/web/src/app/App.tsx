import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLoading } from "../auth/AuthRoot";
import { StartPage } from "../pages/StartPage";
import { ActionFeedbackProvider } from "../components/ActionFeedback";
import { ScrollToTop } from "../components/ScrollToTop";
import { useStore } from "./useStore";
import { markStartupPhase } from "../lib/startupMetrics";

const InboxPage = lazy(() => import("../pages/InboxPage").then((module) => ({ default: module.InboxPage })));
const KnowledgePage = lazy(() => import("../pages/KnowledgePage").then((module) => ({ default: module.KnowledgePage })));
const GoalsPage = lazy(() => import("../pages/GoalsPage").then((module) => ({ default: module.GoalsPage })));
const GoalDetailPage = lazy(() => import("../pages/GoalDetailPage").then((module) => ({ default: module.GoalDetailPage })));
const LegacyFocusHistoryPage = lazy(() => import("../pages/LegacyFocusHistoryPage").then((module) => ({ default: module.LegacyFocusHistoryPage })));
const KnowledgeDetailPage = lazy(() => import("../pages/KnowledgeDetailPage").then((module) => ({ default: module.KnowledgeDetailPage })));
const ActionDetailPage = lazy(() => import("../pages/ActionDetailPage").then((module) => ({ default: module.ActionDetailPage })));
const RoutinesPage = lazy(() => import("../pages/RoutinesPage").then((module) => ({ default: module.RoutinesPage })));
const ProjectsPage = lazy(() => import("../pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("../pages/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })));
const ReviewPage = lazy(() => import("../pages/ReviewPage").then((module) => ({ default: module.ReviewPage })));

export function App() {
  const { loading } = useStore();
  useEffect(() => { if (!loading) markStartupPhase("app-interactive"); }, [loading]);
  return (
    <ActionFeedbackProvider>
      <ScrollToTop />
      <Suspense fallback={<AppLoading label="Ładowanie widoku…" />}><Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/focus" element={<Navigate to="/" replace />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/skrzynka" element={<Navigate to="/knowledge?section=inbox" replace />} />
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
      </Routes></Suspense>
    </ActionFeedbackProvider>
  );
}
