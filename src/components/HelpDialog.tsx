import { useEffect, useRef } from "react";
import { Formula } from "./Formula";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        ref={dialogRef}
      >
        <div className="dialog-header">
          <div>
            <h2 id="help-title">原理说明与操作指南</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="关闭原理说明"
          >
            ×
          </button>
        </div>

        <div className="dialog-content">
          <section>
            <h3>1. “孤立国”在隔离什么？</h3>
            <p>
              1826 年，冯·杜能构造了一个孤立国：平原中央只有一座城市，周围土地肥沃、
              地形平坦、技术相同，运输条件处处一致。农户把产品运往唯一市场，并按每块
              土地能支付的最高地租决定用途。每一组假设都在排除一个干扰源，使距离成为
              唯一变化的空间变量。
            </p>
          </section>

          <section>
            <h3>2. 地租曲线从哪里来？</h3>
            <p>
              单位面积产值是 yᵢpᵢ，生产成本是 yᵢcᵢ，运费是 yᵢtd。三者相减得到区位
              地租：
            </p>
            <Formula compact />
            <p>
              aᵢ 是近市场处的最高竞租，bᵢ 是每增加一公里所损失的地租。不同作物具有
              不同截距和斜率，在任一距离上选择地租最高的用途，就得到图中的上包络。
              包络的折点形成杜能圈边界，零交点是耕作边际。
            </p>
          </section>

          <section>
            <h3>3. 交通线怎样改变圈层？</h3>
            <p>
              本实验将道路附近的有效运费写成
              t<sub>eff</sub> = t · [1 − λ exp(−d<sub>road</sub>² / 2σ²)]。
              其中 d<sub>road</sub> 是到最近一条道路折线的距离。道路中心的有效运费率
              最低，竞租梯度随之变平，耕作极限外移；距离道路较远时，指数项迅速衰减，
              恢复近似圆形。因此圈层不是被拉伸的图片，而是每个位置重新计算地租后的
              真实等值边界。
            </p>
          </section>

          <section>
            <h3>4. 为什么会形成多中心竞争？</h3>
            <p>
              对每个位置，程序计算所有“市场 × 作物”的候选地租，并选择全局最大值。
              两个市场影响范围相接时，各自的最高竞租曲线相交，分界不是简单的垂直平分线，
              而由运费率、城市位置、作物参数和道路条件共同决定。
            </p>
          </section>

          <section>
            <h3>5. 集约程度如何实时计算？</h3>
            <p>
              实验区采用递减边际收益函数
              q<sub>i</sub>(k)=1.6y<sub>i</sub>(1−e<sup>−k</sup>)，
              令边际收益 (p<sub>i</sub>−t<sub>eff</sub>d)q′<sub>i</sub>(k)
              等于投入价格 w，得到最优投入强度 k*。距离越大，市场净价越低，
              集约度随之下降；道路折减会提高净价，使集约带向外延伸。
            </p>
          </section>

          <section className="operation-section">
            <h3>操作说明</h3>
            <div className="operation-grid">
              <div>
                <strong>调节参数</strong>
                <span>
                  通过侧栏“场景与运费 / 作物参数”标签调节 t、yᵢ、pᵢ、cᵢ，
                  地图与曲线同步更新。
                </span>
              </div>
              <div>
                <strong>探索地图</strong>
                <span>
                  悬停圈层、道路或城市才会显示注释；滚轮缩放，移动模式下拖动空白处平移。
                  地图会自动适配全部圈层。用 Tab 聚焦城市后，方向键可微调位置，
                  回车选择市场。
                </span>
              </div>
              <div>
                <strong>绘制与移动道路</strong>
                <span>点击“画道路”后按住鼠标拖动；切回“移动”后可拖动整条道路。道路显示为细实线，不绘制缓冲区。</span>
              </div>
              <div>
                <strong>添加与删除</strong>
                <span>“添加城市”用于放置市场；删除工具可移除道路或任一城市，但至少保留一座市场。</span>
              </div>
              <div>
                <strong>观察剖面</strong>
                <span>选择曲线市场的名称并悬停查看竞租；点击“实际地租”按钮后才叠加最高包络和多市场包络。</span>
              </div>
              <div>
                <strong>管理作物</strong>
                <span>侧栏可增删和重命名 0–7 类作物；点击地图下方图例项，可在图例位置直接调节 y、p、c。</span>
              </div>
              <div>
                <strong>观察集约度</strong>
                <span>在“集约程度”实验区选择作物，调节距离和投入价格，查看最优投入、单产与净收益的实时变化。</span>
              </div>
              <div>
                <strong>重置与布置</strong>
                <span>
                  “重置视图”恢复当前预设的全部参数、作物、城市、道路、缩放与图层开关；
                  重置、切换场景和删除后会显示撤销条，可在十秒内恢复。
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
