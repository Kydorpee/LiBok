import { cva } from "class-variance-authority";

export const buttonStyles = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm text-body-strong transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-action-primary text-text-on-action hover:bg-action-primary-hover disabled:hover:bg-action-primary",
        secondary:
          "border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-hover disabled:hover:bg-bg-surface",
        ghost: "bg-transparent text-text-primary hover:bg-bg-hover disabled:hover:bg-transparent",
        danger:
          "bg-action-danger text-text-on-action hover:bg-action-danger-hover disabled:hover:bg-action-danger",
      },
      size: {
        md: "h-control px-4",
        sm: "h-icon-button px-3",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
