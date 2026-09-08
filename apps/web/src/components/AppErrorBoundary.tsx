import { Component, type ReactNode } from "react";
import { AppErrorReporter } from "../lib/appErrorReporter";

interface Props { children: ReactNode }
interface State { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public componentDidCatch(error: unknown) {
    AppErrorReporter.report(error, "chunk");
  }

  public render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-error-screen" role="alert"><span className="loading-mark">!</span><h1>Coś przerwało działanie aplikacji</h1><p>Możesz wrócić do Startu albo przeładować aplikację. Dane zapisane wcześniej pozostają w przestrzeni pracy.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => { window.location.assign("/"); }}>Wróć do Startu</button><button className="button button-primary" onClick={() => window.location.reload()}>Przeładuj aplikację</button></div></main>;
  }
}
