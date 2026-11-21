import type { ReactNode } from "react";
import { navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import { routeForEntity } from "../domain/routes";
import { NavigationLink } from "./ContextNavigation";
import "./workspace-list.css";

export function WorkspaceListRow({ id, type, title, linkLabel, leading, description, navigation }: {
  id: string;
  type: "goal" | "knowledge";
  title: string;
  linkLabel: string;
  leading: ReactNode;
  description?: ReactNode;
  navigation: { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string };
}) {
  const cardId = navigationCardId(type, id);
  return <li className="workspace-list-row" data-navigation-card-id={cardId} tabIndex={-1}>
    <span className="workspace-row-leading">{leading}</span>
    <div className="workspace-row-main">
      <NavigationLink className="workspace-row-link" to={routeForEntity({ type, id })} {...navigation} sourceCardId={cardId} aria-label={linkLabel}>
        <span className="workspace-row-copy">
          <span className="workspace-row-heading"><strong>{title}</strong></span>
          {description ? <small className="workspace-row-description">{description}</small> : null}
        </span>
      </NavigationLink>
    </div>
  </li>;
}
