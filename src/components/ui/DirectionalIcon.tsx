import type { ComponentType, SVGProps } from "react";

type DirectionalIconProps = SVGProps<SVGSVGElement> & {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Wraps a genuinely directional icon (chevrons, arrows, back/forward
 * controls) so it visually mirrors under `dir="rtl"`. Never apply this to
 * the logo or to product photography — those never mirror (research.md
 * §33, spec FR-070).
 */
export function DirectionalIcon({ icon: Icon, className, style, ...rest }: DirectionalIconProps) {
  return (
    <Icon
      className={className}
      style={{ ...style, transform: "scaleX(var(--icon-flip, 1))" }}
      {...rest}
    />
  );
}
