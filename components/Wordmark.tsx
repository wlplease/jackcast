import { BRAND } from "@/lib/brand";
import Image from "next/image";

export function Wordmark() {
  return (
    <>
      <Image className="wordmark-mark" src="/jackcaster-icon.svg?v=3" width={32} height={32} alt="" aria-hidden="true" priority />
      <span>{BRAND.wordmark.first}<em>{BRAND.wordmark.second}</em></span>
    </>
  );
}
