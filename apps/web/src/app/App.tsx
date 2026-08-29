import { lazy, Suspense, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AppLoading } from "../auth/AuthRoot";
import { StartPage } from "../pages/StartPage";
import { ActionFeedbackProvider } from "../components/ActionFeedback";
import { ScrollToTop } from "../components/ScrollToTop";
import { useStore } from "./useStore";
import { markStartupPhase } from "../lib/startupMetrics";
import { performanceNow, recordPerformanceTiming, viewportBucket } from "../lib/performanceMetrics";
import { readNavigationState } from "../domain/navigation";

function LegacyGoalActionRedirect() {
  const { goalId } = useParams();
  const location = useLocation();
  const { state } = useStore();
  const actionId = new URLSearchParams(location.search).get("action");
  const currentState = readNavigationState(location.state);
  const goal = goalId ? state.goals.find((item) => item.id === goalId) : undefined;
  const fallbackState = goalId ? {
    breadcrumbs: [{ label: "Cele", to: "/goals" }, { label: `Cel: ${goal?.title ?? goalId}`, to: `/goals/${encodeURIComponent(goalId)}` }],
    returnTo: `/goals/${encodeURIComponent(goalId)}`,
    returnLabel: `Cel: ${goal?.title ?? goalId}`,
  } : undefined;
  if (!actionId) return <Navigate to="/goals" replace />;
  return <Navigate replace to={`/actions/${encodeURIComponent(actionId)}`} state={currentState ?? fallbackState} />;
}

function LegacyGoalActionRedirectOrDetail() {
  const location = useLocation();
  return new URLSearchParams(location.search).has("action") ? <LegacyGoalActionRedirect /> : <GoalDetailPage />;
}

function timedImport<T>(route: string, loader: () => Promise<T>) {
  const startedAt = performanceNow();
  return loader().then((module) => {
    recordPerformanceTiming("lazy-route-transition", performanceNow() - startedAt, { route, viewport: viewportBucket() });
    return module;
  });
}

const InboxPage = lazy(() => timedImport("inbox", () => import("../pages/InboxPage").then((module) => ({ default: module.InboxPage }))));
const KnowledgePage = lazy(() => timedImport("knowledge", () => import("../pages/KnowledgePage").then((module) => ({ default: module.KnowledgePage }))));
const GoalsPage = lazy(() => timedImport("goals", () => import("../pages/GoalsPage").then((module) => ({ default: module.GoalsPage }))));
const GoalDetailPage = lazy(() => timedImport("goal-detail", () => import("../pages/GoalDetailPage").then((module) => ({ default: module.GoalDetailPage }))));
const LegacyFocusHistoryPage = lazy(() => timedImport("focus-history", () => import("../pages/LegacyFocusHistoryPage").then((module) => ({ default: module.LegacyFocusHistoryPage }))));
const KnowledgeDetailPage = lazy(() => timedImport("knowledge-detail", () => import("../pages/KnowledgeDetailPage").then((module) => ({ default: module.KnowledgeDetailPage }))));
const ActionDetailPage = lazy(() => timedImport("action-detail", () => import("../pages/ActionDetailPage").then((module) => ({ default: module.ActionDetailPage }))));
const RoutinesPage = lazy(() => timedImport("routines", () => import("../pages/RoutinesPage").then((module) => ({ default: module.RoutinesPage }))));
const ProjectsPage = lazy(() => timedImport("projects", () => import("../pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage }))));
const ProjectDetailPage = lazy(() => timedImport("project-detail", () => import("../pages/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage }))));
const ReviewPage = lazy(() => timedImport("review", () => import("../pages/ReviewPage").then((module) => ({ default: module.ReviewPage }))));

export function App() {
  const { loading } = useStore();
  const appStartRecorded = useRef(false);
  useEffect(() => {
    if (loading || appStartRecorded.current) return;
    appStartRecorded.current = true;
    markStartupPhase("app-interactive");
    recordPerformanceTiming("app-start", performanceNow(), { route: "start", viewport: viewportBucket() });
  }, [loading]);
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
        <Route path="/goals/:goalId" element={<LegacyGoalActionRedirectOrDetail />} />
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
