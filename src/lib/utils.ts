import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function calculateCompoundInterest(
  principal: number,
  monthlyRate: number,
  months: number
) {
  const annualRate = (monthlyRate * 12) / 100;
  const years = months / 12;

  const totalPayable = principal * Math.pow(1 + annualRate, years);
  const interest = totalPayable - principal;

  return {
    principal,
    interest: Number(interest.toFixed(2)),
    totalPayable: Number(totalPayable.toFixed(2)),
  };
}

// Re-export debounce hook from a dedicated module.
export { useDebounce } from "./timing";

