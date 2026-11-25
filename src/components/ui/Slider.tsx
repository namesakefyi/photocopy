import { useRef } from "react";
import {
  NumberField as AriaNumberField,
  Slider as AriaSlider,
  type SliderProps as AriaSliderProps,
  Input,
  Label,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import styles from "./Slider.module.css";

export interface SliderProps extends AriaSliderProps<number> {
  label: string;
}

/** Pressing the number edits it instead of starting a drag on the track. */
const keepFromTrack = (event: React.SyntheticEvent) => event.stopPropagation();

function selectOnFirstPress(event: React.MouseEvent<HTMLInputElement>) {
  event.stopPropagation();
  const input = event.currentTarget;
  if (document.activeElement === input) return;
  event.preventDefault();
  input.focus();
}

export function Slider({ label, ...props }: SliderProps) {
  const thumbInput = useRef<HTMLInputElement>(null);
  const valueInput = useRef<HTMLInputElement>(null);
  return (
    <AriaSlider {...props} className={styles.slider}>
      <SliderTrack className={styles.track}>
        {({ state }) => (
          <>
            <div
              className={styles.fill}
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
            <Label className={styles.label}>{label}</Label>
            <AriaNumberField
              aria-label={label}
              className={styles.value}
              value={state.values[0]}
              minValue={state.getThumbMinValue(0)}
              maxValue={state.getThumbMaxValue(0)}
              step={state.step}
              formatOptions={props.formatOptions}
              isDisabled={state.isDisabled}
              onChange={(value) => {
                if (!Number.isNaN(value)) state.setThumbValue(0, value);
              }}
            >
              <Input
                ref={valueInput}
                className={styles.input}
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === "Enter") thumbInput.current?.focus();
                }}
                onFocus={(event) => event.target.select()}
                onPointerDown={keepFromTrack}
                onMouseDown={selectOnFirstPress}
                onTouchStart={keepFromTrack}
              />
            </AriaNumberField>
            <SliderThumb
              className={styles.thumb}
              inputRef={thumbInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") valueInput.current?.focus();
              }}
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
