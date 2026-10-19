import { twMerge } from "tailwind-merge";

/** Sınıf birleştirici (sunucu ve istemci bileşenlerinde kullanılabilir). */
export const cn = (...s: (string | false | null | undefined)[]) => twMerge(s.filter(Boolean).join(" "));