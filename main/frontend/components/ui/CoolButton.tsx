import React from "react";
import { cn } from "../utils/cn";

interface CoolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  /** Match the same variants as regular Button for consistent theming */
  variant?: 'cool' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'outline' | 'ghost';
  loading?: boolean;
  children: React.ReactNode;
}

export function CoolButton({
  size = "md",
  variant = "cool",
  loading = false,
  className,
  children,
  ...props
}: CoolButtonProps) {
  const sizeClasses: Record<NonNullable<CoolButtonProps["size"]>, string> = {
    sm: "h-9",
    md: "h-10",
    lg: "h-11",
  };

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      data-variant={variant}
      className={cn(
        "cool-button select-none",
        // outer frame (transparent padding ring area)
        // use CSS variables via Tailwind arbitrary properties:
        "[--inset:6px] rounded-md p-[var(--inset)]",
        // translucent outer glass
        "bg-white/15 shadow-[0_4px_10px_rgba(0,0,0,0.10)]",
        sizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          "cap w-full h-full inline-flex items-center justify-center rounded-[0.200rem]",
          // bg/fg driven by CSS vars set by data-variant
          "text-[color:var(--cool-btn-fg)]",
          // background supports arbitrary value too:
          "bg-[var(--cool-btn-bg)]",
          // borders and shadows
          "border-t border-b",
          "border-t-white/10 border-b-black/55",
          "shadow-[0_6px_12px_-2px_rgba(0,0,0,0.45),_0_2px_4px_rgba(0,0,0,0.40)]",
          // transitions & typography (match text-sm)
          "transition-[transform,filter,background] duration-150 ease-in-out",
          "text-sm font-medium leading-5 px-3",
          // hover/disabled effects
          "hover:brightness-[1.07]",
          "[&:disabled]:brightness-90 [&:disabled]:grayscale"
        )}
      >
        {loading ? "Loading..." : children}
      </span>
    </button>
  );
}

