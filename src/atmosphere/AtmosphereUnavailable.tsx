import { Icon } from "../home/Icons";
import type { Theme } from "../theme";
import "./atmosphere-unavailable.css";

interface AtmosphereUnavailableProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBackHome: () => void;
}

export default function AtmosphereUnavailable({
  theme,
  onToggleTheme,
  onBackHome,
}: AtmosphereUnavailableProps) {
  return (
    <div className="atfu-page" data-theme={theme}>
      <header className="atfu-topbar">
        <button
          aria-label="返回泉盒子地理可视化平台首页"
          className="atfu-brand"
          onClick={onBackHome}
          type="button"
        >
          <span className="atfu-brand-mark">泉</span>
          <span>
            <strong>泉盒子的地理可视化平台</strong>
            <small>QUANHEZI GEO VISUAL PLATFORM</small>
          </span>
        </button>
        <div className="atfu-top-actions">
          <button
            aria-label={theme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
            className="atfu-icon-button"
            onClick={onToggleTheme}
            type="button"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <button className="atfu-home-button" onClick={onBackHome} type="button">
            平台首页
          </button>
        </div>
      </header>

      <main className="atfu-main">
        <section className="atfu-hero" aria-labelledby="atfu-title">
          <div className="atfu-copy">
            <div className="atfu-status">
              <span />
              暂未开放 · FRONT-END ACCESS PAUSED
            </div>
            <h1 id="atfu-title">大气受力实验室正在校准</h1>
            <p>
              本实验室在当前版本暂停开放。这里不会加载交互画布、参数控制或受力计算，
              以免把尚未完成校准的模型作为教学结果使用。
            </p>
            <div className="atfu-actions">
              <button
                className="atfu-primary-button"
                onClick={onBackHome}
                type="button"
              >
                返回平台首页
                <Icon name="arrowRight" size={17} />
              </button>
              <a className="atfu-secondary-button" href="#von-thunen">
                进入杜能环
              </a>
              <a className="atfu-secondary-button" href="#dijkstra">
                进入 Dijkstra
              </a>
            </div>
          </div>

          <div className="atfu-diagram" aria-hidden="true">
            <svg fill="none" viewBox="0 0 560 440">
              <g className="atfu-isobars">
                <path d="M54 94C168 30 391 31 512 111" />
                <path d="M44 166C177 94 402 96 521 181" />
                <path d="M43 244C177 166 406 169 521 253" />
                <path d="M49 327C184 243 405 246 515 331" />
                <path d="M59 405C196 315 409 321 505 405" />
              </g>
              <g className="atfu-forces">
                <path className="is-pressure" d="M280 220 181 181" />
                <path className="is-coriolis" d="M280 220 330 126" />
                <path className="is-centrifugal" d="M280 220 374 248" />
                <path className="is-friction" d="M280 220 209 286" />
              </g>
              <circle className="atfu-ring is-outer" cx="280" cy="220" r="70" />
              <circle className="atfu-ring is-inner" cx="280" cy="220" r="45" />
              <path className="atfu-pause" d="M268 202v36M292 202v36" />
              <text className="atfu-diagram-label" x="280" y="337">
                MODEL ACCESS PAUSED
              </text>
            </svg>
          </div>
        </section>

        <section className="atfu-notes" aria-label="开放说明">
          <article>
            <span>当前状态</span>
            <h2>入口保留，交互暂停</h2>
            <p>
              首页仍保留大气受力实验室的位置。重新开放后，访客会从相同入口进入原有实验，
              不需要寻找新的地址。
            </p>
          </article>
          <article>
            <span>现在可用</span>
            <h2>另外两个实验室正常开放</h2>
            <p>
              农业区位与最短路径实验不受影响，可从上方按钮直接进入，也可返回首页查看完整介绍。
            </p>
          </article>
        </section>
      </main>

      <footer className="atfu-footer">
        <span>© 2026 泉盒子的地理可视化平台</span>
        <button onClick={onBackHome} type="button">
          返回平台首页 ↑
        </button>
      </footer>
    </div>
  );
}
