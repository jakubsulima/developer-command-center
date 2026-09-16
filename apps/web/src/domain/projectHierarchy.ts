import type { Area } from "./types";

export function validateProjectParent(projects: Area[], projectId: string, parentId?: string | null) {
  const visited = new Set([projectId]);
  let current = parentId;
  while (current) {
    if (visited.has(current)) throw new Error("Projekt nie może należeć do siebie ani swojego podprojektu.");
    visited.add(current);
    const parent = projects.find((project) => project.id === current);
    if (!parent) throw new Error("Projekt nadrzędny jest niedostępny.");
    current = parent.parentProjectId;
  }
}

export function projectParentOptions(projects: Area[], projectId?: string) {
  return projects.filter((project) => {
    if (project.visibility !== "active") return false;
    try { validateProjectParent(projects, projectId ?? "", project.id); return true; }
    catch { return false; }
  }).sort((a, b) => a.name.localeCompare(b.name));
}
