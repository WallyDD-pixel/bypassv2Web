import React, { type ElementType, type ComponentPropsWithoutRef } from "react";

type Padding = "none" | "sm" | "md" | "lg";
type GlassCardOwnProps<E extends ElementType> = {
  padding?: Padding;
  as?: E;
};

type GlassCardProps<E extends ElementType> = GlassCardOwnProps<E> & Omit<ComponentPropsWithoutRef<E>, "as">;

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

const padMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard<E extends ElementType = "div">({ as, padding = "md", className, children, ...rest }: GlassCardProps<E>) {
  const Comp = (as || "div") as ElementType;
  return (
    <Comp
      className={cx(
        "rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl",
        padMap[padding],
        className
      )}
      {...(rest as object)}
    >
      {children}
    </Comp>
  );
}

export default GlassCard;
