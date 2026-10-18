import { BRAND } from "@/lib/brand";

export function Wordmark() {
  return (
    <>
      {BRAND.wordmark.first}
      <em>{BRAND.wordmark.second}</em>
    </>
  );
}
