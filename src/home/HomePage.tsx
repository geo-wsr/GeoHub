import {
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import heroClassic from "../../artifacts/feature-shots/01-single-center.png";
import heroDijkstra from "../../artifacts/fit-1440x900.png";
import heroAtmosphere from "../../artifacts/atmosphere-desktop-light.png";
import type { Theme } from "../theme";
import { BrandMark, Icon } from "./Icons";
import "./home.css";

interface HomePageProps {
  onEnterLab: () => void;
  onEnterDijkstra: () => void;
  onEnterAtmosphere: () => void;
  onToggleTheme: () => void;
  theme: Theme;
}

interface HeroSlide {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  note: string;
  lab: "von-thunen" | "dijkstra" | "atmosphere";
  browserLabel: string;
  cta: string;
  viewNote: string;
}

interface SearchEntry {
  label: string;
  detail: string;
  target: string;
  keywords: string;
  lab?: "von-thunen" | "dijkstra" | "atmosphere";
}

const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: "01 / 农业区位 · 杜能环",
    title: "让区位选择，在参数改变时被看见。",
    description:
      "从地租、距离、交通和市场出发，把农业圈层与竞租曲线放进同一个可编辑模型，观察每一块土地为何属于这种用途。",
    image: heroClassic,
    imageAlt: "杜能环交互实验室的单中心场景界面",
    note: "地租 × 距离 × 土地用途",
    lab: "von-thunen",
    browserLabel: "实验室 / 杜能环",
    cta: "进入杜能环",
    viewNote: "地图 ↔ 竞租曲线",
  },
  {
    eyebrow: "02 / 网络分析 · Dijkstra",
    title: "把最短路径，拆成可以观察的每一步。",
    description:
      "编辑加权图、设置起终点，逐步检查优先队列、距离表和松弛事件，再从 prev 表反向回溯一条完整路径。",
    image: heroDijkstra,
    imageAlt: "Dijkstra 最短路径实验室的三栏工作台",
    note: "松弛 × 优先队列 × 前驱表",
    lab: "dijkstra",
    browserLabel: "实验室 / Dijkstra",
    cta: "进入 Dijkstra",
    viewNote: "图网络 ↔ 事件状态",
  },
  {
    eyebrow: "03 / 大气动力学 · 受力平衡",
    title: "让四力平衡，变成可以调参的风场。",
    description:
      "调节气压梯度、纬度、曲率和摩擦，用原生 SVG 矢量合成理解地转风、梯度风与边界层偏转。",
    image: heroAtmosphere,
    imageAlt: "大气水平运动受力实验室的矢量平衡工作台",
    note: "四力 × 风速 × 偏转",
    lab: "atmosphere",
    browserLabel: "实验室 / 大气受力",
    cta: "进入大气受力",
    viewNote: "力矢量 ↔ 平衡风",
  },
];

const FEATURES = [
  {
    icon: "grid" as const,
    index: "01",
    title: "三个独立模型",
    description: "农业区位、网络最短路径与大气四力平衡，各自拥有完整的工作台。",
  },
  {
    icon: "layers" as const,
    index: "02",
    title: "输入与结果同屏",
    description: "参数、地图、曲线、事件表与矢量图始终共享同一组计算结果。",
  },
  {
    icon: "compass" as const,
    index: "03",
    title: "过程可以追踪",
    description: "松弛步骤、圈层变化和力的合成都能逐步观察，而不只呈现最终答案。",
  },
  {
    icon: "book" as const,
    index: "04",
    title: "回到同一入口",
    description: "每个实验室都能随时返回平台首页，在三个模型之间保持清晰路径。",
  },
];

const SEARCH_INDEX: SearchEntry[] = [
  {
    label: "杜能环 · 农业区位实验室",
    detail: "实验 · 地租、距离与土地用途",
    target: "experiment-lab",
    keywords: "杜能 杜能环 农业 区位 地租 地图 曲线 经济地理",
    lab: "von-thunen",
  },
  {
    label: "Dijkstra · 最短路径实验室",
    detail: "实验 · 图编辑、优先队列与路径回溯",
    target: "experiment-dijkstra",
    keywords: "Dijkstra 最短路径 图 网络 可达性 优先队列 算法 SVG",
    lab: "dijkstra",
  },
  {
    label: "大气水平运动 · 受力实验室",
    detail: "实验 · 四力平衡、梯度风与边界层",
    target: "experiment-atmosphere",
    keywords: "大气 气象 风 气压梯度力 地转偏向力 科里奥利力 离心力 摩擦力 梯度风",
    lab: "atmosphere",
  },
  {
    label: "地图与曲线同步",
    detail: "能力 · 同一组参数驱动两种表达",
    target: "about",
    keywords: "地图 曲线 联动 同步 可视化",
  },
];

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const top =
    target.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 760 ? 76 : 88);
  window.scrollTo({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    top,
  });
}

export default function HomePage({
  onEnterLab,
  onEnterDijkstra,
  onEnterAtmosphere,
  onToggleTheme,
  theme,
}: HomePageProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return [];
    return SEARCH_INDEX.filter((entry) =>
      `${entry.label} ${entry.detail} ${entry.keywords}`
        .toLowerCase()
        .includes(normalized),
    ).slice(0, 5);
  }, [searchQuery]);

  const goToSlide = useCallback((next: number) => {
    setSlideIndex((next + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);

  useEffect(() => {
    if (carouselPaused) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setSlideIndex((current) => (current + 1) % HERO_SLIDES.length);
      }
    }, 7200);
    return () => window.clearInterval(timer);
  }, [carouselPaused]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  function handleSearchSubmit(event?: FormEvent) {
    event?.preventDefault();
    const result = matches[activeSearchIndex] ?? matches[0];
    if (result) {
      activateSearchEntry(result);
      return;
    }
    if (searchQuery.trim()) {
      scrollToSection("experiments");
    }
  }

  function selectSearchResult(entry: SearchEntry) {
    setSearchQuery(entry.label);
    setSearchOpen(false);
    setMenuOpen(false);
    activateSearchEntry(entry);
  }

  function activateSearchEntry(entry: SearchEntry) {
    if (entry.lab) {
      enterLabByKey(entry.lab);
      return;
    }
    scrollToSection(entry.target);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && matches.length) {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length) {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSearchIndex(
        (current) => (current - 1 + matches.length) % matches.length,
      );
    } else if (event.key === "Escape") {
      setSearchOpen(false);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    pointerStart.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < 42) return;
    goToSlide(slideIndex + (delta < 0 ? 1 : -1));
  }

  function enterLab() {
    setMenuOpen(false);
    onEnterLab();
  }

  function enterDijkstra() {
    setMenuOpen(false);
    onEnterDijkstra();
  }

  function enterAtmosphere() {
    setMenuOpen(false);
    onEnterAtmosphere();
  }

  function enterLabByKey(lab: HeroSlide["lab"]) {
    if (lab === "von-thunen") enterLab();
    else if (lab === "dijkstra") enterDijkstra();
    else enterAtmosphere();
  }

  const currentSlide = HERO_SLIDES[slideIndex];

  return (
    <div className="qh-home" data-theme={theme}>
      <a className="qh-skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="qh-header">
        <div className="qh-shell qh-header-inner">
          <a
            aria-label="泉盒子的地理可视化平台首页"
            className="qh-brand"
            href="#home"
            onClick={() => setMenuOpen(false)}
          >
            <BrandMark className="qh-brand-mark" />
            <span className="qh-brand-copy">
              <strong>泉盒子的地理可视化平台</strong>
              <small>QUANHEZI GEO VISUAL PLATFORM</small>
            </span>
          </a>

          <nav aria-label="主导航" className="qh-nav">
            <a className="is-active" href="#home">
              首页
            </a>
            <a href="#experiments">实验库</a>
            <a href="#about">关于</a>
          </nav>

          <div className="qh-header-actions">
            <div className="qh-search-wrap" ref={searchWrapRef}>
              <form
                aria-label="站内搜索"
                className="qh-search"
                onSubmit={handleSearchSubmit}
                role="search"
              >
                <Icon className="qh-search-icon" name="search" size={16} />
                <input
                  aria-autocomplete="list"
                  aria-controls="qh-search-results"
                  aria-expanded={searchOpen && matches.length > 0}
                  aria-label="搜索实验、场景或主题"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveSearchIndex(0);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="搜索实验与主题"
                  role="combobox"
                  type="search"
                  value={searchQuery}
                />
              </form>
              {searchOpen && searchQuery.trim() && (
                <div
                  aria-label="搜索结果"
                  className="qh-search-results"
                  id="qh-search-results"
                  role="listbox"
                >
                  {matches.length ? (
                    matches.map((entry, index) => (
                      <button
                        aria-selected={activeSearchIndex === index}
                        className={
                          activeSearchIndex === index ? "is-active" : undefined
                        }
                        key={`${entry.target}-${entry.label}`}
                        onClick={() => selectSearchResult(entry)}
                        onMouseEnter={() => setActiveSearchIndex(index)}
                        role="option"
                        type="button"
                      >
                        <span>
                          <strong>{entry.label}</strong>
                          <small>{entry.detail}</small>
                        </span>
                        <Icon name="arrowRight" size={15} />
                      </button>
                    ))
                  ) : (
                    <p className="qh-search-empty">
                      暂未找到对应条目，试试“地租”或“交通”。
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
              className="qh-icon-button qh-theme-toggle"
              onClick={onToggleTheme}
              title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
              type="button"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>

            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"}
              className="qh-icon-button qh-menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <Icon name={menuOpen ? "close" : "menu"} size={19} />
            </button>

            <button
              className="qh-header-cta"
              onClick={() => scrollToSection("experiments")}
              type="button"
            >
              查看三个实验室
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="qh-mobile-menu">
            <div className="qh-shell">
              <form
                aria-label="移动端站内搜索"
                className="qh-mobile-search"
                onSubmit={handleSearchSubmit}
                role="search"
              >
                <Icon name="search" size={17} />
                <input
                  aria-label="搜索实验、场景或主题"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveSearchIndex(0);
                  }}
                  placeholder="搜索地租、交通、双城…"
                  type="search"
                  value={searchQuery}
                />
                <button type="submit">查找</button>
              </form>
              {matches.length > 0 && searchQuery.trim() && (
                <div className="qh-mobile-results">
                  {matches.slice(0, 3).map((entry) => (
                    <button
                      key={`mobile-${entry.target}-${entry.label}`}
                      onClick={() => selectSearchResult(entry)}
                      type="button"
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              )}
              <nav aria-label="移动端主导航">
                <a href="#home" onClick={() => setMenuOpen(false)}>
                  首页 <span>01</span>
                </a>
                <a href="#experiments" onClick={() => setMenuOpen(false)}>
                  实验库 <span>02</span>
                </a>
                <a href="#about" onClick={() => setMenuOpen(false)}>
                  关于 <span>03</span>
                </a>
              </nav>
              <button
                className="qh-mobile-enter"
                onClick={() => {
                  setMenuOpen(false);
                  scrollToSection("experiments");
                }}
                type="button"
              >
                查看三个实验室
                <Icon name="arrowRight" size={17} />
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        <section
          aria-label="平台主视觉"
          className="qh-hero"
          id="home"
          onBlurCapture={() => setCarouselPaused(false)}
          onFocusCapture={() => setCarouselPaused(true)}
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <ContourBackdrop />
          <div className="qh-shell qh-hero-grid">
            <div className="qh-hero-copy" key={`copy-${slideIndex}`}>
              <div className="qh-eyebrow-row">
                <span className="qh-status-dot" />
                <span>交互式地理可视化平台</span>
                <span className="qh-eyebrow-rule" />
                <span>
                  {String(slideIndex + 1).padStart(2, "0")} /{" "}
                  {String(HERO_SLIDES.length).padStart(2, "0")}
                </span>
              </div>
              <p className="qh-slide-eyebrow">{currentSlide.eyebrow}</p>
              <h1>{currentSlide.title}</h1>
              <p className="qh-hero-description">{currentSlide.description}</p>
              <div className="qh-hero-actions">
                <button
                  className="qh-primary-button"
                  onClick={() => enterLabByKey(currentSlide.lab)}
                  type="button"
                >
                  {currentSlide.cta}
                  <Icon name="arrowRight" size={17} />
                </button>
                <a className="qh-secondary-button" href="#experiments">
                  查看全部实验
                </a>
              </div>
              <dl className="qh-hero-facts">
                <div>
                  <dt>03</dt>
                  <dd>个完整实验室</dd>
                </div>
                <div>
                  <dt>03</dt>
                  <dd>套空间模型</dd>
                </div>
                <div>
                  <dt>LIVE</dt>
                  <dd>浏览器实时计算</dd>
                </div>
              </dl>
            </div>

            <div className="qh-hero-product">
              <div className="qh-product-halo" aria-hidden="true" />
              <div className="qh-browser">
                <div className="qh-browser-bar">
                  <div className="qh-window-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>{currentSlide.browserLabel}</span>
                  <span className="qh-browser-live">
                    <i />
                    LIVE
                  </span>
                </div>
                <div className="qh-browser-body">
                  <img
                    alt={currentSlide.imageAlt}
                    draggable="false"
                    key={`image-${slideIndex}`}
                    src={currentSlide.image}
                  />
                  <div className="qh-image-tint" aria-hidden="true" />
                </div>
                <div className="qh-image-caption">
                  <span>{currentSlide.note}</span>
                  <span>{currentSlide.viewNote}</span>
                </div>
              </div>
              <span className="qh-floating-label qh-floating-label--left">
                <Icon name="compass" size={16} />
                参数驱动
              </span>
              <span className="qh-floating-label qh-floating-label--right">
                实时联动
                <Icon name="layers" size={16} />
              </span>
            </div>
          </div>

          <div className="qh-shell qh-carousel-controls">
            <div className="qh-carousel-progress">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  aria-label={`查看第 ${index + 1} 张：${slide.eyebrow}`}
                  aria-pressed={slideIndex === index}
                  className={slideIndex === index ? "is-active" : undefined}
                  key={slide.eyebrow}
                  onClick={() => goToSlide(index)}
                  type="button"
                >
                  <span />
                </button>
              ))}
            </div>
            <div className="qh-carousel-arrows">
              <button
                aria-label="上一张"
                onClick={() => goToSlide(slideIndex - 1)}
                type="button"
              >
                <Icon name="chevronLeft" size={17} />
              </button>
              <span>{String(slideIndex + 1).padStart(2, "0")}</span>
              <button
                aria-label="下一张"
                onClick={() => goToSlide(slideIndex + 1)}
                type="button"
              >
                <Icon name="chevronRight" size={17} />
              </button>
            </div>
          </div>
        </section>

        <section className="qh-section qh-about-preview" id="about">
          <div className="qh-shell">
            <div className="qh-section-heading">
              <div>
                <span className="qh-kicker">ABOUT / 关于平台</span>
                <h2>三个模型，同一种把空间讲清楚的方式。</h2>
              </div>
              <aside className="qh-about-brief" aria-label="平台简介">
                <span>平台简介</span>
                <p>
                  平台把农业区位、网络分析与大气动力学的模型假设、空间结果与解释
                  放在同一组可视化工作台里；三个实验室入口平级，可按课堂主题自由选择。
                </p>
              </aside>
            </div>

            <div className="qh-feature-grid">
              {FEATURES.map((feature) => (
                <article className="qh-feature-card" key={feature.title}>
                  <div className="qh-feature-top">
                    <span className="qh-feature-icon">
                      <Icon name={feature.icon} size={19} />
                    </span>
                    <span className="qh-feature-index">{feature.index}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="qh-section qh-experiments" id="experiments">
          <div className="qh-shell">
            <div className="qh-section-heading qh-section-heading--row">
              <div>
                <span className="qh-kicker">EXPERIMENTS / 实验库</span>
                <h2>从模型开始，把变量逐一推开。</h2>
              </div>
              <p className="qh-section-meta">当前开放 03 个实验 · 更多模块持续构建</p>
            </div>

            <div className="qh-experiment-grid">
              <div className="qh-experiment-list">
                <a
                  aria-labelledby="lab-von-title"
                  className="qh-featured-experiment qh-von-card"
                  href="#von-thunen"
                  id="experiment-lab"
                >
                <div className="qh-featured-copy">
                  <div className="qh-featured-meta">
                    <span>01 / 经济地理</span>
                    <span className="qh-live-pill">
                      <i />
                      可进入
                    </span>
                  </div>
                  <h3 id="lab-von-title">杜能环</h3>
                  <p className="qh-featured-subtitle">农业区位交互实验室</p>
                  <p className="qh-featured-description">
                    从地租、距离和运费出发，编辑作物参数、拖动市场、绘制道路，
                    在圈层与竞租曲线的同步变化里理解农业区位。
                  </p>
                  <div className="qh-featured-stats">
                    <div>
                      <strong>0–7</strong>
                      <span>类作物参数</span>
                    </div>
                    <div>
                      <strong>04</strong>
                      <span>个场景入口</span>
                    </div>
                    <div>
                      <strong>∞</strong>
                      <span>次自由尝试</span>
                    </div>
                  </div>
                  <span className="qh-light-button">
                    进入杜能环实验室
                    <Icon name="arrowRight" size={17} />
                  </span>
                </div>
                <div className="qh-featured-visual" aria-hidden="true">
                  <span className="qh-ring-label qh-ring-label--one">园艺</span>
                  <span className="qh-ring-label qh-ring-label--two">林业</span>
                  <span className="qh-ring-label qh-ring-label--three">谷物</span>
                  <span className="qh-ring-label qh-ring-label--four">畜牧</span>
                  <svg fill="none" viewBox="0 0 560 560">
                    <circle
                      className="qh-ring qh-ring--1"
                      cx="280"
                      cy="280"
                      r="250"
                    />
                    <circle
                      className="qh-ring qh-ring--2"
                      cx="280"
                      cy="280"
                      r="203"
                    />
                    <circle
                      className="qh-ring qh-ring--3"
                      cx="280"
                      cy="280"
                      r="155"
                    />
                    <circle
                      className="qh-ring qh-ring--4"
                      cx="280"
                      cy="280"
                      r="111"
                    />
                    <circle
                      className="qh-ring qh-ring--5"
                      cx="280"
                      cy="280"
                      r="70"
                    />
                    <circle className="qh-market-ripple" cx="280" cy="280" r="30" />
                    <circle className="qh-market-point" cx="280" cy="280" r="7" />
                    <path
                      className="qh-axis-line"
                      d="M22 280h516M280 22v516"
                    />
                  </svg>
                  <span className="qh-computed-note">
                    <small>RENT / 竞租</small>
                    <strong>aᵢ − bᵢd</strong>
                  </span>
                </div>
                </a>

                <a
                  aria-labelledby="lab-dijkstra-title"
                  className="qh-featured-experiment qh-dijkstra-card"
                  href="#dijkstra"
                  id="experiment-dijkstra"
                >
                  <div className="qh-featured-copy">
                    <div className="qh-featured-meta">
                      <span>02 / 网络分析</span>
                      <span className="qh-live-pill">
                        <i />
                        可进入
                      </span>
                    </div>
                    <h3 id="lab-dijkstra-title">Dijkstra</h3>
                    <p className="qh-featured-subtitle">最短路径算法可视化实验室</p>
                    <p className="qh-featured-description">
                      编辑有向或无向图，逐步观察优先队列、距离表与松弛事件，
                      再用前驱表反向回溯一条完整的最短路径。
                    </p>
                    <div className="qh-featured-stats">
                      <div>
                        <strong>06</strong>
                        <span>类核心事件</span>
                      </div>
                      <div>
                        <strong>30</strong>
                        <span>节点上限</span>
                      </div>
                      <div>
                        <strong>SVG</strong>
                        <span>原生图编辑</span>
                      </div>
                    </div>
                    <span className="qh-light-button">
                      进入 Dijkstra 实验室
                      <Icon name="arrowRight" size={17} />
                    </span>
                  </div>
                  <div className="qh-featured-visual qh-dijkstra-visual" aria-hidden="true">
                    <svg fill="none" viewBox="0 0 560 440">
                      <g className="qh-di-edges">
                        <path d="M74 289 176 138 300 218 408 116 482 255" />
                        <path d="M176 138 218 327 300 218 343 337 482 255" />
                        <path d="M74 289 218 327 408 116" />
                      </g>
                      <g className="qh-di-path">
                        <path d="M74 289 300 218 408 116 482 255" />
                      </g>
                      <g className="qh-di-nodes">
                        {[
                          ["A₁", 74, 289],
                          ["A₂", 176, 138],
                          ["A₃", 218, 327],
                          ["A₄", 300, 218],
                          ["A₅", 343, 337],
                          ["A₆", 408, 116],
                          ["A₇", 482, 255],
                        ].map(([label, x, y]) => (
                          <g key={label} transform={`translate(${x} ${y})`}>
                            <circle r="23" />
                            <text
                              dominantBaseline="central"
                              textAnchor="middle"
                              x="0"
                              y="0"
                            >
                              {label}
                            </text>
                          </g>
                        ))}
                      </g>
                      <g className="qh-di-weights">
                        {[
                          [4, 125, 213.5],
                          [7, 238, 178],
                          [3, 354, 167],
                          [6, 445, 185.5],
                          [2, 146, 308],
                          [5, 259, 272.5],
                          [3, 321.5, 277.5],
                          [2, 412.5, 296],
                        ].map(([weight, x, y], index) => (
                          <g
                            key={`${weight}-${index}`}
                            transform={`translate(${x} ${y})`}
                          >
                            <rect height="16" rx="4" width="20" x="-10" y="-8" />
                            <text
                              dominantBaseline="central"
                              textAnchor="middle"
                              x="0"
                              y="0"
                            >
                              {weight}
                            </text>
                          </g>
                        ))}
                      </g>
                    </svg>
                    <span className="qh-di-queue">
                      <small>PRIORITY QUEUE</small>
                      <strong>(8, A₇) · (11, A₅) · (∞, …)</strong>
                    </span>
                    <span className="qh-di-distance">
                      <small>DIST / 当前距离</small>
                      <strong>dist[A₇] = 8</strong>
                    </span>
                  </div>
                </a>

                <a
                  aria-labelledby="lab-atmosphere-title"
                  className="qh-featured-experiment qh-atmosphere-card"
                  href="#atmosphere"
                  id="experiment-atmosphere"
                >
                  <div className="qh-featured-copy">
                    <div className="qh-featured-meta">
                      <span>03 / 大气动力学</span>
                      <span className="qh-live-pill">
                        <i />
                        可进入
                      </span>
                    </div>
                    <h3 id="lab-atmosphere-title">大气受力</h3>
                    <p className="qh-featured-subtitle">
                      水平运动的四力平衡与风场
                    </p>
                    <p className="qh-featured-description">
                      调节气压梯度、纬度、曲率和摩擦，用实时 SVG
                      矢量合成理解地转风、梯度风与边界层偏转。
                    </p>
                    <div className="qh-featured-stats">
                      <div>
                        <strong>04</strong>
                        <span>个水平作用力</span>
                      </div>
                      <div>
                        <strong>03</strong>
                        <span>类平衡状态</span>
                      </div>
                      <div>
                        <strong>LIVE</strong>
                        <span>二维平衡求解</span>
                      </div>
                    </div>
                    <span className="qh-light-button">
                      进入大气受力实验室
                      <Icon name="arrowRight" size={17} />
                    </span>
                  </div>
                  <div
                    className="qh-featured-visual qh-atmosphere-visual"
                    aria-hidden="true"
                  >
                    <svg fill="none" viewBox="0 0 560 440">
                      <g className="qh-atf-isobars">
                        <path d="M64 78C184 24 394 29 498 102" />
                        <path d="M54 150C189 84 393 87 510 166" />
                        <path d="M51 230C185 155 402 159 515 239" />
                        <path d="M56 314C193 230 401 235 506 318" />
                        <path d="M68 396C200 308 404 315 495 394" />
                      </g>
                      <g className="qh-atf-vectors">
                        <path className="qh-atf-pressure" d="M280 220L180 182" />
                        <path className="qh-atf-coriolis" d="M280 220L330 126" />
                        <path className="qh-atf-centrifugal" d="M280 220L374 248" />
                        <path className="qh-atf-friction" d="M280 220L209 286" />
                        <path className="qh-atf-wind" d="M280 220L360 197" />
                      </g>
                      <g className="qh-atf-labels">
                        <text x="154" y="170">Fp</text>
                        <text x="334" y="112">Fc</text>
                        <text x="382" y="258">C</text>
                        <text x="174" y="305">Ff</text>
                        <text x="366" y="187">V</text>
                      </g>
                      <circle className="qh-atf-particle-ring" cx="280" cy="220" r="19" />
                      <circle className="qh-atf-particle" cx="280" cy="220" r="7" />
                      <text className="qh-atf-h" x="480" y="74">H</text>
                      <text className="qh-atf-l" x="81" y="406">L</text>
                    </svg>
                    <span className="qh-atf-formula">
                      <small>FORCE BALANCE / 四力合成</small>
                      <strong>ΣF = 0 → V, θ</strong>
                    </span>
                  </div>
                </a>
              </div>

            </div>
          </div>
        </section>

      </main>

      <footer className="qh-footer">
        <div className="qh-shell qh-footer-inner">
          <div className="qh-footer-brand">
            <BrandMark className="qh-footer-mark" />
            <div>
              <strong>泉盒子的地理可视化平台</strong>
              <span>平台 · QUANHEZI GEO VISUAL PLATFORM</span>
            </div>
          </div>
          <p>
            为地理学习而做。模型数值与边界用于解释机制，不代表特定地区的实测结果。
          </p>
          <div className="qh-footer-links">
            <button onClick={enterLab} type="button">
              杜能环实验室
            </button>
            <button onClick={enterDijkstra} type="button">
              Dijkstra 实验室
            </button>
            <button onClick={enterAtmosphere} type="button">
              大气受力实验室
            </button>
            <a href="#home">返回顶部 ↑</a>
          </div>
        </div>
        <div className="qh-shell qh-footer-bottom">
          <span>© 2026 泉盒子的地理可视化平台</span>
          <span>ECONOMIC GEOGRAPHY / VISUAL NOTE</span>
        </div>
      </footer>
    </div>
  );
}

function ContourBackdrop({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <div
      aria-hidden="true"
      className={`qh-contour-backdrop qh-contour-backdrop--${variant}`}
    >
      <svg fill="none" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 900">
        <g stroke="currentColor" strokeWidth="1">
          <path d="M-90 192c150-80 264 65 424-8s275-130 454-49 307 125 529 39 270-76 309-36" />
          <path d="M-86 246c163-87 279 58 438-12s286-126 465-46 304 120 526 38 279-76 319-34" />
          <path d="M-82 301c176-93 293 51 451-16s298-121 477-42 300 114 522 35 288-75 328-30" />
          <path d="M-78 357c188-99 307 44 465-20s310-116 489-38 296 108 518 32 298-73 338-26" />
          <path d="M-74 413c200-105 320 37 478-24s322-111 501-34 292 102 514 29 308-71 348-22" />
          <path d="M-70 469c212-111 333 30 491-28s334-106 513-30 288 96 510 26 318-69 358-18" />
          <path d="M-66 525c224-117 346 23 504-32s346-101 525-26 284 90 506 23 328-67 368-14" />
          <path d="M-62 581c236-123 359 16 517-36s358-96 537-22 280 84 502 20 338-65 378-10" />
          <path d="M-58 637c248-129 372 9 530-40s370-91 549-18 276 78 498 16 348-62 388-6" />
          <path d="M-54 693c260-135 385 2 543-44s382-86 561-14 272 72 494 13 358-60 398-2" />
          <path d="M-50 749c272-141 398-5 556-48s394-81 573-10 268 66 490 10 368-58 408 2" />
        </g>
        <g
          className="qh-contour-focus"
          opacity={variant === "dark" ? "0.28" : "0.38"}
        >
          <path d="M915 284c77-43 173-25 221 41 42 58 22 135-44 172-68 39-162 29-208-31-45-59-39-145 31-182Z" />
          <path d="M941 316c56-30 124-16 158 31 30 42 14 95-34 120-50 26-113 18-145-23-31-42-25-101 21-128Z" />
          <path d="M971 351c34-18 76-9 95 20 17 26 8 56-21 71-29 15-65 10-84-14-18-25-14-60 10-77Z" />
        </g>
      </svg>
    </div>
  );
}
