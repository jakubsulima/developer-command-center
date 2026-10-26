// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workflowDirectory = new URL("../../../../.github/workflows/", import.meta.url);

describe("bezpieczeństwo GitHub Actions", () => {
  it("przypina wszystkie zewnętrzne akcje do commitów", async () => {
    for (const filename of ["ci.yml", "supabase-deploy.yml"]) {
      const workflow = await readFile(new URL(filename, workflowDirectory), "utf8");
      const actionReferences = [...workflow.matchAll(/^\s*uses:\s*[^\s#]+/gm)].map(([reference]) => reference);
      expect(actionReferences.length).toBeGreaterThan(0);
      for (const reference of actionReferences) expect(reference).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it("uruchamia deployment tylko z main i nie przekazuje sekretów instalatorowi", async () => {
    const workflow = await readFile(new URL("supabase-deploy.yml", workflowDirectory), "utf8");
    const jobConfiguration = workflow.slice(workflow.indexOf("jobs:"), workflow.indexOf("    steps:"));
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain("pnpm install --frozen-lockfile --ignore-scripts");
    expect(jobConfiguration).not.toMatch(/^\s+env:/m);
    expect(workflow.indexOf("pnpm install --frozen-lockfile --ignore-scripts")).toBeLessThan(workflow.indexOf("SUPABASE_ACCESS_TOKEN"));
  });

  it("synchronizuje tylko main do dev przez API merge bez uruchamiania kodu repozytorium", async () => {
    const workflow = await readFile(new URL("sync-dev.yml", workflowDirectory), "utf8");
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain('"repos/${GH_REPO}/merges"');
    expect(workflow).toContain("-f base=dev");
    expect(workflow).toContain("-f head=main");
    expect(workflow).toContain("exit 1");
    expect(workflow).not.toMatch(/pull_request|uses:|secrets\.|git push|git reset/);
  });
});
