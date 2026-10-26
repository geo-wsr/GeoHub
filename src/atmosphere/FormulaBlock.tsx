import katex from "katex";
import type { ReactNode } from "react";

interface FormulaBlockProps {
  latex: string;
  label?: string;
}

export function FormulaBlock({ latex, label }: FormulaBlockProps) {
  const markup = katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    strict: false,
  });

  return (
    <div className="atf-formula-block">
      {label && <span className="atf-formula-label">{label}</span>}
      <div
        className="atf-formula-katex"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}

interface InlineMathProps {
  latex: string;
  children?: ReactNode;
}

export function InlineMath({ latex, children }: InlineMathProps) {
  const markup = katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    strict: false,
  });
  return (
    <span
      className="atf-inline-math"
      dangerouslySetInnerHTML={{ __html: markup }}
      aria-label={children ? undefined : latex}
    />
  );
}
