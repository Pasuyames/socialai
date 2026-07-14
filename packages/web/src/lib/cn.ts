import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui standardı: koşullu sınıfları birleştir + Tailwind çakışmalarını
 * (ör. "p-4" + "p-6" → "p-6") akıllıca çöz. Tüm premium bileşenler bunu kullanır.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
