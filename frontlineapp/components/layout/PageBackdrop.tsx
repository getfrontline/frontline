export function PageBackdropFixed() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.4]"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(ellipse 120% 80% at 10% -20%, var(--glow-1), transparent 50%),
            radial-gradient(ellipse 90% 60% at 100% 10%, var(--glow-2), transparent 45%),
            radial-gradient(ellipse 70% 50% at 50% 100%, var(--glow-3), transparent 55%)
          `,
        }}
      />
      <div className="grain pointer-events-none fixed inset-0 -z-10" aria-hidden />
    </>
  );
}
