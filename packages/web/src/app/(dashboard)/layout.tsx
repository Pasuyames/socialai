import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-[#060609]">
      {/* Ambient arka plan — derin radial parıltılar + ince ızgara */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.13] blur-[120px]"
          style={{ background: "radial-gradient(circle, #6C5CE7, transparent 70%)" }}
        />
        <div
          className="absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full opacity-[0.10] blur-[120px]"
          style={{ background: "radial-gradient(circle, #00D2FF, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
          }}
        />
      </div>

      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-7">{children}</main>
      </div>
    </div>
  );
}
