import katex from "katex";
import type { ReactNode } from "react";

interface FormulaProps {
  compact?: boolean;
}

const formula = String.raw`R_i(d)=y_ip_i-y_ic_i-y_i t d
=\underbrace{y_i(p_i-c_i)}_{a_i}
-\underbrace{y_i t}_{b_i}d`;

export function Formula({ compact = false }: FormulaProps) {
  const markup = katex.renderToString(formula, {
    displayMode: true,
    throwOnError: false,
    strict: false,
  });

  return (
    <div className={`formula ${compact ? "formula-compact" : ""}`}>
      <div
        className="formula-katex"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <div className="formula-legend">
        <span>
          <InlineFormula latex="a_i" /> = 城郊最高竞租
        </span>
        <span>
          <InlineFormula latex="b_i" /> = 单位距离地租梯度
        </span>
        <span>
          <InlineFormula latex="R_i" /> = 区位地租
        </span>
      </div>
    </div>
  );
}

interface InlineFormulaProps {
  latex: string;
  className?: string;
  fallback?: ReactNode;
}

export function InlineFormula({
  latex,
  className = "",
  fallback,
}: InlineFormulaProps) {
  const markup = katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    strict: false,
  });

  return (
    <span
      className={`inline-formula ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: markup }}
      aria-label={fallback ? undefined : latex}
    />
  );
}
