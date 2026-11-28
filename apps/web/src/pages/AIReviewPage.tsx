import { AIGoalReview } from "../components/AIGoalReview";
import { AppShell, PageHeading } from "../components/AppShell";

export function AIReviewPage() {
  return (
    <AppShell>
      <PageHeading title="Przegląd AI" />
      <AIGoalReview />
    </AppShell>
  );
}
