import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatMoney(value: number, currencySymbol: string = "₹") {
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  return `${isNegative ? "-" : ""}${currencySymbol}${absVal.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export interface SharingInfo {
  author: "user1" | "user2" | "user3" | null;
  share: "private" | "user1" | "user2" | "user3" | "both" | null;
}

export function parseSharingTags(title: string): SharingInfo {
  if (!title) return { author: null, share: null };
  const authorMatch = title.match(/\[author:(user1|user2|user3)\]/);
  const shareMatch = title.match(/\[share:(private|user1|user2|user3|both)\]/);
  return {
    author: authorMatch ? (authorMatch[1] as "user1" | "user2" | "user3") : null,
    share: shareMatch ? (shareMatch[1] as "private" | "user1" | "user2" | "user3" | "both") : null
  };
}

export function cleanSharingTags(title: string): string {
  if (!title) return "";
  return title
    .replace(/\s*\[author:(user1|user2|user3)\]/g, "")
    .replace(/\s*\[share:(private|user1|user2|user3|both)\]/g, "")
    .trim();
}

export function buildSharingSuffix(author: string, share: string): string {
  return ` [author:${author}][share:${share}]`;
}

