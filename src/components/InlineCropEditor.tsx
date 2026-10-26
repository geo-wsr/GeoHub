import type { ReactNode } from "react";
import { formatRent, getCropEconomics } from "../rent";
import type { CropDefinition } from "../types";
import { InlineFormula } from "./Formula";

interface InlineSliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  digits?: number;
  onChange: (value: number) => void;
}

function InlineSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  digits = 0,
  onChange,
}: InlineSliderProps) {
  return (
    <label className="inline-parameter">
      <span>
        {label}
        <output>
          {digits > 0 ? value.toFixed(digits) : Math.round(value)}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

interface InlineCropEditorProps {
  crop: CropDefinition;
  cropIndex: number;
  freightRate: number;
  onChange: (
    field: keyof Pick<
      CropDefinition,
      "yieldPerHa" | "pricePerTonne" | "costPerTonne"
    >,
    value: number,
  ) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function InlineCropEditor({
  crop,
  cropIndex,
  freightRate,
  onChange,
  onRename,
  onDelete,
  onClose,
}: InlineCropEditorProps) {
  const economics = getCropEconomics(crop, freightRate);

  return (
    <div className="inline-crop-editor" data-crop-index={cropIndex}>
      <div className="inline-editor-head">
        <span
          className="crop-dot"
          style={{ backgroundColor: crop.color }}
          aria-hidden="true"
        />
        <label>
          <span className="sr-only">重命名当前作物</span>
          <input
            value={crop.name}
            maxLength={20}
            onChange={(event) => onRename(event.target.value)}
          />
        </label>
        <span className="inline-editor-caption">图例就地调参</span>
        <button
          type="button"
          className="inline-delete"
          onClick={onDelete}
          aria-label={`删除${crop.name}`}
        >
          删除
        </button>
        <button
          type="button"
          className="inline-close"
          onClick={onClose}
          aria-label="关闭作物参数编辑器"
        >
          ×
        </button>
      </div>

      <div className="inline-parameter-grid">
        <InlineSlider
          label={
            <>
              单产 <InlineFormula latex={`y_{${cropIndex}}`} />
            </>
          }
          value={crop.yieldPerHa}
          min={1}
          max={45}
          step={0.25}
          digits={2}
          suffix=" t/ha"
          onChange={(value) => onChange("yieldPerHa", value)}
        />
        <InlineSlider
          label={
            <>
              价格 <InlineFormula latex={`p_{${cropIndex}}`} />
            </>
          }
          value={crop.pricePerTonne}
          min={500}
          max={3200}
          step={10}
          suffix=" 元/t"
          onChange={(value) => onChange("pricePerTonne", value)}
        />
        <InlineSlider
          label={
            <>
              成本 <InlineFormula latex={`c_{${cropIndex}}`} />
            </>
          }
          value={crop.costPerTonne}
          min={200}
          max={2800}
          step={10}
          suffix=" 元/t"
          onChange={(value) => onChange("costPerTonne", value)}
        />
      </div>

      <div className="inline-equation">
        <InlineFormula
          latex={`a_{${cropIndex}}=${formatRent(economics.a)}\\qquad b_{${cropIndex}}=${formatRent(economics.b)}`}
        />
      </div>
    </div>
  );
}
