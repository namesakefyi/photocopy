import {
  Slider as AriaSlider,
  type SliderProps as AriaSliderProps,
  Label,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import styles from "./Slider.module.css";

export interface SliderProps extends AriaSliderProps<number> {
  label: string;
}

export function Slider({ label, ...props }: SliderProps) {
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
            <SliderOutput className={styles.output} />
            <SliderThumb className={styles.thumb} />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
