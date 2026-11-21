import type { ComponentType } from "react";

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

export function withClassName<C extends ComponentType<any>>(
  Component: C,
  base: string,
): C {
  const Styled: ComponentType<any> = Component;
  return ((props: { className?: string }) => (
    <Styled {...props} className={cx(base, props.className)} />
  )) as C;
}
