import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentry 3D - Monitoramento de Rede",
  description: "Monitoramento de infraestrutura em malha neural 3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-[#050505] text-slate-100 overflow-hidden">
        <div className="relative w-screen h-screen overflow-hidden bg-[#050505]">
          {/* Ambient light glows for premium styling */}
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] bg-[rgba(168,85,247,0.05)] blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[800px] bg-[rgba(6,182,212,0.04)] blur-[150px] rounded-full pointer-events-none" />
          {children}
        </div>
      </body>
    </html>
  );
}