import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Os estilos de texto do design (text-body, text-label...) são utilitários próprios;
// sem isso o tailwind-merge os confunde com cores de texto e descarta um dos dois.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["display", "title", "subtitle", "body", "body-strong", "label", "caption", "stat"],
        },
      ],
    },
  },
});

/** Junta classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
