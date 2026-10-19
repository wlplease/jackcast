/** Pause Jackcaster's soundtrack when the user deliberately opens another audio experience. */
export function pauseBackgroundAudio() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("jackcaster:pause-background-audio"));
}
