import { useEffect, useRef } from "react";
import { FormulaBlock, InlineMath } from "./FormulaBlock";

interface AtmosphereHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AtmosphereHelpDialog({
  open,
  onClose,
}: AtmosphereHelpDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="atf-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="atf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atf-dialog-title"
      >
        <header className="atf-dialog-header">
          <div>
            <span className="atf-eyebrow">FIELD NOTES / 原理手册</span>
            <h2 id="atf-dialog-title">四力如何合成一支风？</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="atf-dialog-close"
            aria-label="关闭原理说明"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="atf-dialog-body">
          <section>
            <h3>01 · 气压梯度力</h3>
            <p>
              气压分布不均时，空气受到由高压指向低压的加速度。等压线越密，
              单位距离的气压差越大，气压梯度力越强。本页把{" "}
              <InlineMath latex="\Delta p/\Delta n" /> 换算为 hPa/100 km，
              再除以空气密度。
            </p>
            <FormulaBlock
              label="单位质量力"
              latex={String.raw`\vec{F}_p=-\frac{1}{\rho}\nabla p,\qquad G=\frac{1}{\rho}\frac{\Delta p}{\Delta n}`}
            />
          </section>

          <section>
            <h3>02 · 地转偏向力</h3>
            <p>
              地球自转使水平运动出现惯性偏向。北半球力指向运动方向右侧，
              南半球指向左侧；赤道处科氏参数为零。它不是把风速推快的“动力”，
              而是垂直于速度、只改变方向的惯性效应。
            </p>
            <FormulaBlock
              latex={String.raw`\vec{F}_c=-f\hat{k}\times\vec{V},\qquad f=2\Omega\sin\varphi`}
            />
          </section>

          <section>
            <h3>03 · 惯性离心力与梯度风</h3>
            <p>
              沿曲线等压线运动时，在以流线为参照的描述中出现沿曲率半径向外的
              惯性离心力。直线运动时 <InlineMath latex="R\to\infty" />，该项为零。
              低压与高压的梯度风速度不同，因为气压梯度力与离心力在高、低压中心
              指向相反。
            </p>
            <FormulaBlock
              latex={String.raw`C=\frac{V^2}{R},\qquad \vec{F}_p+\vec{F}_c+\vec{C}=0`}
            />
          </section>

          <section>
            <h3>04 · 摩擦力与边界层偏转</h3>
            <p>
              近地面湍流拖曳用简化线性项表示。摩擦使风速减小、地转偏向力也减小，
              于是风不再与等压线平行，而是斜穿等压线并指向低压一侧。摩擦越大，
              偏角通常越大，但不是无限增大；平衡位置由四个矢量共同决定。
            </p>
            <FormulaBlock
              latex={String.raw`\vec{F}_f=-k\vec{V},\qquad \vec{F}_{\mathrm{net}}=\sum_i\vec{F}_i`}
            />
          </section>

          <section>
            <h3>三种平衡状态</h3>
            <div className="atf-balance-explain">
              <div>
                <strong>地转平衡</strong>
                <span>
                  直线、等速、无摩擦：气压梯度力与地转偏向力等大反向，风平行于等压线。
                </span>
              </div>
              <div>
                <strong>梯度风平衡</strong>
                <span>
                  曲线、无摩擦：气压梯度力、地转偏向力、惯性离心力三力平衡。
                  北半球低压逆时针、高压顺时针。
                </span>
              </div>
              <div>
                <strong>边界层风</strong>
                <span>
                  摩擦参与后，风与等压线形成夹角；北半球仍向运动右侧偏，
                  但整体速度向低压侧旋转。
                </span>
              </div>
            </div>
          </section>

          <section>
            <h3>操作提示</h3>
            <div className="atf-operation-grid">
              <div>
                <strong>调节参数</strong>
                <span>
                  移动气压梯度、纬度、半径和摩擦滑块，主图、曲线、角度指针同步更新。
                </span>
              </div>
              <div>
                <strong>回归平衡</strong>
                <span>
                  “由平衡计算”会数值求解零合力风速；切回自由调节可检查任意风向。
                </span>
              </div>
              <div>
                <strong>拖动几何</strong>
                <span>
                  圆形模式下拖动中心移动等压线；拖动空气质点调整曲率半径。
                </span>
              </div>
              <div>
                <strong>读图顺序</strong>
                <span>
                  先看气压梯度方向，再看地转偏向力相对速度的左右关系，最后观察合力。
                </span>
              </div>
            </div>
          </section>

          <section className="atf-dialog-note">
            <h3>简化与边界</h3>
            <p>
              这是水平面的教学模型：忽略垂直运动、真实地形、非均匀密度、边界层分层、
              动量方程的时间变化，以及实际天气系统中的非圆形等压线。摩擦项采用线性
              拖曳，适合解释方向趋势，不应当作特定地点的定量风预报。
            </p>
            <p>
              概念与公式参考用户指定知乎专栏、Wikipedia 的 Coriolis force /
              Geostrophic wind / Gradient wind / Ekman layer / Friction 条目，以及
              动力气象学中对水平力平衡的标准处理。
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
