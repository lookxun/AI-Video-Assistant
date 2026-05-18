"use client";

import { useState } from "react";
import Link from "next/link";
import { RiArrowUpLine } from "react-icons/ri";

const homeAssetVersion = "color-fluid-carousel-20260515";
const heroVideos = [
  "/home-assets/hero-background.mp4",
  "/home-assets/hero-dragon.mp4",
  "/home-assets/hero-great-wall.mp4",
  "/home-assets/hero-global-human.mp4",
  "/home-assets/hero-mecha-robot.mp4",
];

export default function Home() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [homePrompt, setHomePrompt] = useState("");

  const activeVideo = heroVideos[activeVideoIndex];

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: isLoginOpen ? "translateX(-8vw)" : "translateX(0)", filter: isLoginOpen ? "blur(8px)" : undefined, transition: "transform 300ms ease-out, filter 300ms ease-out" }}
      >
        <video
          key={activeVideo}
          className="absolute inset-0 h-full w-full object-cover"
          src={`${activeVideo}?v=${homeAssetVersion}`}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setActiveVideoIndex((current) => (current + 1) % heroVideos.length)}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(88,130,255,0.28),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(62,211,218,0.2),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.78),rgba(0,0,0,0.42)_46%,rgba(0,0,0,0.72))]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34),transparent_34%,rgba(0,0,0,0.78))]" />
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {heroVideos.map((video, index) => (
            <button
              key={video}
              type="button"
              onClick={() => setActiveVideoIndex(index)}
              className={`h-1 rounded-full transition-all ${index === activeVideoIndex ? "w-8 bg-white/82" : "w-3 bg-white/28 hover:bg-white/46"}`}
              aria-label={`切换首页视频 ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div
        className="relative z-10 min-h-screen transition-transform duration-300 ease-out"
        style={{ transform: isLoginOpen ? "translateX(-8vw)" : "translateX(0)", filter: isLoginOpen ? "blur(8px)" : undefined, transition: "transform 300ms ease-out, filter 300ms ease-out" }}
      >
      <header className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home-assets/logo.png" alt="闪念 FlashMuse" className="h-[50px] w-[50px] object-contain drop-shadow-[0_0_18px_rgba(116,166,255,0.38)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home-assets/logo-text.png" alt="闪念" className="w-auto object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]" style={{ height: 30, filter: "brightness(0) invert(1)" }} />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/workspace" className="rounded-full bg-white px-5 py-2 text-[13px] font-medium text-black shadow-[0_10px_30px_rgba(0,0,0,0.16)] transition hover:bg-white/88">
            进入工作台
          </Link>
          <button
            type="button"
            onClick={() => setIsLoginOpen(true)}
            className="rounded-full border border-white/18 bg-white/10 px-5 py-2 text-[13px] font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:bg-white/18"
          >
            登录
          </button>
        </div>
      </header>

      <form
        className="absolute z-30"
        style={{ left: "50%", top: "50%", width: "100%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}
        onSubmit={(event) => event.preventDefault()}
      >
        <div style={{ marginBottom: 48 }}>
          <h1
            className="text-center leading-tight text-white"
            style={{
              fontFamily: '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif',
              fontSize: 100,
              fontWeight: 550,
              letterSpacing: "normal",
              opacity: 0.9,
              whiteSpace: "nowrap",
            }}
          >
            方寸之间 · 大有可为
          </h1>
          <p
            className="text-center text-white"
            style={{
              fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
              marginTop: 12,
              fontSize: 40,
              fontWeight: 300,
              letterSpacing: "0.01em",
              opacity: 0.72,
              whiteSpace: "nowrap",
            }}
          >
            Small Space Big Ideas
          </p>
        </div>
        <div
          className="px-4 py-3 transition"
          style={{
            width: "min(700px, calc(100% - 48px))",
            borderRadius: 16,
            border: "1px solid rgba(255, 255, 255, 0.22)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08) 42%, rgba(8,10,18,0.38))",
            boxShadow: "0 24px 88px rgba(0,0,0,0.42), 0 8px 28px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -22px 42px rgba(255,255,255,0.08)",
            backdropFilter: "blur(42px) saturate(210%) brightness(1.08)",
            WebkitBackdropFilter: "blur(42px) saturate(210%) brightness(1.08)",
          }}
        >
          <div className="flex items-center gap-3">
            <input
              value={homePrompt}
              onChange={(event) => setHomePrompt(event.target.value)}
              placeholder="灵感一闪，创意即生..."
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/62"
            />
            <button
              type="submit"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000]"
              aria-label="发送"
            >
              <RiArrowUpLine className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>
      </div>

      {isLoginOpen ? (
        <div className="fixed inset-0 z-50 bg-black/18" onMouseDown={() => setIsLoginOpen(false)}>
          <aside
            className="absolute right-0 top-0 h-full bg-white text-[#111111] shadow-[-28px_0_80px_rgba(0,0,0,0.2)]"
            style={{ width: "min(33.333vw, 560px)", minWidth: 420, animation: "home-login-slide-in 0.22s ease-out" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
                setIsLoginOpen(false);
              }}
              className="absolute flex items-center justify-center text-[#333333] transition hover:text-black"
              style={{ left: 12, top: 12, width: 48, height: 48, zIndex: 10, pointerEvents: "auto" }}
              aria-label="关闭登录面板"
            >
              <span className="home-login-close-mark" aria-hidden="true" style={{ position: "relative", width: 48, height: 48, display: "block" }}>
                <span style={{ position: "absolute", left: 6, top: 23, width: 36, height: 1.5, borderRadius: 999, background: "currentColor", transform: "rotate(45deg)" }} />
                <span style={{ position: "absolute", left: 6, top: 23, width: 36, height: 1.5, borderRadius: 999, background: "currentColor", transform: "rotate(-45deg)" }} />
              </span>
            </button>

            <div className="flex h-full flex-col items-center justify-center px-12" style={{ transform: "translateY(-14%)" }}>
              <div className="flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/home-assets/logo.png" alt="闪念 FlashMuse" className="h-[72px] w-[72px] object-contain" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/home-assets/logo-text.png" alt="闪念" className="w-auto object-contain" style={{ height: 34 }} />
              </div>

              <form className="mt-12 w-full" style={{ maxWidth: 380 }} onSubmit={(event) => event.preventDefault()}>
                <div className="mb-5 flex items-center justify-center gap-4">
                  <button type="button" className="text-[14px] font-medium text-[#111111] transition hover:text-black">
                    密码登录
                  </button>
                  <span className="h-3.5 w-px bg-[#d8d8d8]" aria-hidden="true" />
                  <button type="button" className="text-[14px] font-medium text-[#8a8a8a] transition hover:text-[#111111]">
                    验证码登录
                  </button>
                </div>
                <input
                  type="email"
                  placeholder="请输入邮箱"
                  className="h-16 w-full rounded-2xl border border-[#e3e3e3] bg-[#f7f7f7] px-4 text-[14px] text-[#111111] outline-none transition placeholder:text-[#b0b0b0] hover:border-[#b9d2ff] focus:border-[#367cee] focus:bg-[#f7f7f7]"
                />
              </form>
            </div>
            <div className="absolute bottom-8 left-0 w-full px-8 text-center text-[12px] text-[#8a8a8a]">
              登录即代表同意
              <button type="button" className="text-[#367cee] hover:text-[#1f63d9]">《用户协议》</button>
              和
              <button type="button" className="text-[#367cee] hover:text-[#1f63d9]">《隐私政策》</button>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
