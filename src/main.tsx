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
import { getInitialTheme, type Theme } from "./theme";

const App = lazy(() => import("./App"));
const DijkstraLab = lazy(() => import("./dijkstra/DijkstraLab"));
const AtmosphericLab = lazy(() => import("./atmosphere/AtmosphericLab"));

type PlatformView = "home" | "von-thunen" | "dijkstra" | "atmosphere";

function viewFromHash(): PlatformView {
  if (window.location.hash.startsWith("#von-thunen")) return "von-thunen";
  if (window.location.hash.startsWith("#dijkstra")) return "dijkstra";
  if (window.location.hash.startsWith("#atmosphere")) return "atmosphere";
  return "home";
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
          ? "杜能环 · 平台"
          : nextView === "dijkstra"
            ? "Dijkstra 最短路径算法可视化实验室 · 平台"
            : nextView === "atmosphere"
              ? "大气水平运动受力实验室 · 平台"
          : "泉盒子的地理可视化平台";
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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#101612" : "#f5f7f3");
  }, [theme]);

  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));

  if (view === "von-thunen") {
    return (
      <Suspense fallback={<RouteLoading />}>
        <App theme={theme} onToggleTheme={toggleTheme} />
      </Suspense>
    );
  }

  if (view === "dijkstra") {
    return (
      <Suspense fallback={<RouteLoading />}>
        <DijkstraLab
          onBackHome={() => {
            window.location.hash = "";
          }}
          onOpenVonThunen={() => {
            window.location.hash = "von-thunen";
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
        <AtmosphericLab
          theme={theme}
          onBackHome={() => {
            window.location.hash = "";
          }}
          onToggleTheme={toggleTheme}
        />
      </Suspense>
    );
  }

  return (
    <HomePage
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
