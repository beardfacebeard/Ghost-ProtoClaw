export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ghost-black px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-brand-glow opacity-80" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </main>
  );
}
