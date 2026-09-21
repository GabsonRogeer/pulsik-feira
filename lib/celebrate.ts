export async function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 120,
      spread: 95,
      origin: { y: 0.65 },
      colors: ["#b899ff", "#91d9eb", "#ffffff", "#ffca91"],
      disableForReducedMotion: true,
    });
    setTimeout(
      () =>
        confetti({
          particleCount: 70,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.55 },
          colors: ["#b899ff", "#91d9eb", "#ffffff"],
          disableForReducedMotion: true,
        }),
      350,
    );
  } catch {}
}
