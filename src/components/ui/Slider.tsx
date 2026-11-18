import {
  Slider as AriaSlider,
  type SliderProps as AriaSliderProps,
  Label,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";

export interface SliderProps extends AriaSliderProps<number> {
  label: string;
}

/**
 * A slider drawn as one box: the name and value sit inside it, the fill
 * shows the amount, and dragging anywhere in the box sets it.
 */
export function Slider({ label, ...props }: SliderProps) {
  return (
    <AriaSlider {...props} className="slider">
      <SliderTrack>
        {({ state }) => (
          <>
            <div
              className="fill"
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
            <Label>{label}</Label>
            <SliderOutput />
            <SliderThumb />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
