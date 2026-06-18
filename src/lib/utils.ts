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
  const totalPayable = principal * Math.pow(1 + (monthlyRate / 100), months);
  const interest = totalPayable - principal;

  return {
    principal,
    interest: Number(interest.toFixed(2)),
    totalPayable: Number(totalPayable.toFixed(2)),
  };
}

// Re-export debounce hook from a dedicated module.
export { useDebounce } from "./timing";

export function formatCompactIfLarge(val: number) {
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  if (absVal >= 10000000) return (isNeg ? "-" : "") + `₹${(absVal / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (absVal >= 1500000) return (isNeg ? "-" : "") + `₹${(absVal / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val || 0);
}
