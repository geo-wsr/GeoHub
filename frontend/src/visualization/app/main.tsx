import {
  StrictMode,
  Suspense,
  lazy,
  useEffect,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import "katex/dist/katex.min.css";
import "./styles.css";
import HomePage from "./home/HomePage";
import { ATMOSPHERE_ENABLED } from "./platformFeatures";
import { getInitialTheme, type Theme } from "./theme";

const App = lazy(() => import("./App"));
const DijkstraLab = lazy(() => import("./dijkstra/DijkstraLab"));
const AtmosphericLab = lazy(() => import("./atmosphere/AtmosphericLab"));
const AtmosphereUnavailable = lazy(
  () => import("./atmosphere/AtmosphereUnavailable"),
);

type PlatformView = "home" | "von-thunen" | "dijkstra" | "atmosphere";

function viewFromHash(): PlatformView {
  if (window.location.hash.startsWith("#von-thunen")) return "von-thunen";
  if (window.location.hash.startsWith("#dijkstra")) return "dijkstra";
  if (window.location.hash.startsWith("#atmosphere")) return "atmosphere";
  return "home";
}

function postToHost(type: string, payload: Record<string, string> = {}) {
  if (window.parent === window) return false;
  window.parent.postMessage(
    { type, ...payload },
    window.location.origin,
  );
  return true;
}

function returnToVisualizationPortal() {
  if (postToHost("geohub:return-to-labs")) return;
  window.location.assign(
    new URL("../visualization", window.location.href).href,
  );
}

function PlatformRoot() {
  const [view, setView] = useState<PlatformView>(viewFromHash);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    function syncRoute() {
      const nextView = viewFromHash();
      setView(nextView);
      document.title =
        nextView === "von-thunen"
          ? "杜能环 · 泉盒子的GeoHub"
          : nextView === "dijkstra"
            ? "Dijkstra 最短路径 · 泉盒子的GeoHub"
            : nextView === "atmosphere"
              ? ATMOSPHERE_ENABLED
                ? "大气水平运动受力 · 泉盒子的GeoHub"
                : "大气受力实验室 · 暂未开放 · 泉盒子的GeoHub"
          : "可视化实验室 · 泉盒子的GeoHub";
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("quanhezi-theme", theme);
    postToHost("geohub:lab-theme", { theme });
    const pageColor =
      view === "home"
        ? theme === "dark"
          ? "#191313"
          : "#f4ebdf"
        : theme === "dark"
          ? "#101612"
          : "#f5f7f3";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", pageColor);
  }, [theme, view]);

  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));

  if (view === "von-thunen") {
    return (
      <Suspense fallback={<RouteLoading />}>
        <App
          theme={theme}
          onBackHome={returnToVisualizationPortal}
          onToggleTheme={toggleTheme}
        />
      </Suspense>
    );
  }

  if (view === "dijkstra") {
    return (
      <Suspense fallback={<RouteLoading />}>
        <DijkstraLab
          onBackHome={returnToVisualizationPortal}
          onOpenVonThunen={() => {
            window.location.hash = "von-thunen";
          }}
          onOpenAtmosphere={() => {
            window.location.hash = "atmosphere";
          }}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
      </Suspense>
    );
  }

  if (view === "atmosphere") {
    return (
      <Suspense fallback={<RouteLoading />}>
        {ATMOSPHERE_ENABLED ? (
          <AtmosphericLab
            theme={theme}
            onBackHome={returnToVisualizationPortal}
            onToggleTheme={toggleTheme}
          />
        ) : (
          <AtmosphereUnavailable
            theme={theme}
            onBackHome={returnToVisualizationPortal}
            onToggleTheme={toggleTheme}
          />
        )}
      </Suspense>
    );
  }

  return (
    <HomePage
      atmosphereEnabled={ATMOSPHERE_ENABLED}
      onEnterLab={() => {
        window.location.hash = "von-thunen";
      }}
      onEnterDijkstra={() => {
        window.location.hash = "dijkstra";
      }}
      onEnterAtmosphere={() => {
        window.location.hash = "atmosphere";
      }}
      onToggleTheme={toggleTheme}
      theme={theme}
    />
  );
}

function RouteLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="正在载入实验"
      style={{
        display: "grid",
        minHeight: "70vh",
        placeItems: "center",
        color: "#68746d",
        fontFamily: "sans-serif",
        fontSize: 13,
      }}
    >
      正在载入交互实验室…
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlatformRoot />
  </StrictMode>,
);
