"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiAccountCircleLine, RiArrowUpLine, RiCornerDownLeftLine, RiLogoutBoxRLine, RiSettingsLine, RiShieldUserLine, RiVipDiamondLine } from "react-icons/ri";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";

const homeAssetVersion = "home-lite-carousel-20260605";
const HOME_VIDEO_CACHE_KEY = `flashmuse-home-videos-ready-${homeAssetVersion}`;
const MALAYSIA_HOME_URL = "https://main.venusface.com/";
const ALI_HOME_URL = "https://ali.venusface.com/";
const heroSlides = [
  { image: "/home-assets/hero-poster-lite.jpg", video: "/home-assets/hero-background-lite.mp4" },
  { image: "/home-assets/hero-dragon-reference-lite.jpg", video: "/home-assets/hero-dragon-lite.mp4" },
  { image: "/home-assets/hero-great-wall-reference-lite.jpg", video: "/home-assets/hero-great-wall-lite.mp4" },
  { image: "/home-assets/hero-global-human-reference-lite.jpg", video: "/home-assets/hero-global-human-lite.mp4" },
  { image: "/home-assets/hero-mecha-robot-reference-lite.jpg", video: "/home-assets/hero-mecha-robot-lite.mp4" },
];
const staticAssetBaseUrl = (process.env.NEXT_PUBLIC_STATIC_BASE_URL ?? "").replace(/\/$/, "");

function staticAssetUrl(path: string) {
  if (!staticAssetBaseUrl || /^https?:\/\//i.test(path)) return path;
  return `${staticAssetBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

type LoginMode = "password" | "code";
type LoginStep = "email" | "password" | "code";
type CodeSendSource = "manual" | "auto";
type HomeSite = "malaysia" | "ali" | "other";
type HomeUserDialogTab = "profile" | "credits" | "security" | "settings";
type HomeUserProfile = {
  email: string;
  nickname?: string;
  avatarUrl?: string;
};
const LOGIN_HISTORY_KEY = "flashmuse-login-history-v1";
const MAX_LOGIN_HISTORY = 5;
const HOME_PROMPT_STORAGE_KEY = "flashmuse-home-prompt-v1";
const WORKSPACE_USER_DIALOG_STORAGE_KEY = "flashmuse-workspace-user-dialog-v1";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "请求失败");
  return data as T;
}

function isCompleteEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getDefaultUserAvatar(email: string) {
  const normalizedEmail = email.trim().toLowerCase() || "user";
  let hash = 0;

  for (let index = 0; index < normalizedEmail.length; index += 1) {
    hash = (hash * 31 + normalizedEmail.charCodeAt(index)) >>> 0;
  }

  const hue = hash % 360;
  const label = (normalizedEmail[0] ?? "U").toUpperCase();

  return {
    label,
    backgroundColor: `hsl(${hue} 82% 92%)`,
    borderColor: `hsl(${hue} 58% 84%)`,
    color: `hsl(${hue} 38% 34%)`,
  };
}

function openWorkspaceFresh() {
  window.location.assign(`/workspace?fresh=${Date.now()}`);
}

function getCurrentHomeSite(hostname: string): HomeSite {
  if (hostname === "main.venusface.com" || hostname === "api.venusface.com" || hostname === "101.47.19.109") return "malaysia";
  if (hostname === "ali.venusface.com" || hostname === "static.venusface.com" || hostname === "101.37.129.164") return "ali";
  return "other";
}

export default function Home() {
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [isHeroVideoReady, setIsHeroVideoReady] = useState(false);
  const [homePrompt, setHomePrompt] = useState("");
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [loginStep, setLoginStep] = useState<LoginStep>("email");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginCode, setLoginCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [loginMessage, setLoginMessage] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [loginHistory, setLoginHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(LOGIN_HISTORY_KEY);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, MAX_LOGIN_HISTORY) : [];
    } catch {
      return [];
    }
  });
  const [isLoginHistoryOpen, setIsLoginHistoryOpen] = useState(false);
  const [codeSendSource, setCodeSendSource] = useState<CodeSendSource>("manual");
  const [currentUser, setCurrentUser] = useState<HomeUserProfile | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [homeSite, setHomeSite] = useState<HomeSite>("other");
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const loginHistoryMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const activeHeroSlide = heroSlides[activeHeroIndex];
  const canSubmitEmail = loginEmail.trim().length > 0 && !isLoginSubmitting;
  const defaultUserAvatar = getDefaultUserAvatar(currentUser?.email ?? "");
  const logoTargetUrl = homeSite === "malaysia" ? ALI_HOME_URL : MALAYSIA_HOME_URL;
  const logoTargetLabel = homeSite === "malaysia" ? "切换到阿里首页" : "切换到马来首页";
  const showInternationalBadge = homeSite === "malaysia";

  useBodyScrollLock(isLoginOpen);

  const refreshCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { user?: HomeUserProfile | null };
      setCurrentUser(data.user?.email ? data.user : null);
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoaded(true);
    }
  };

  const resetLoginForm = () => {
    setLoginMode("password");
    setLoginStep("email");
    setLoginEmail("");
    setLoginPassword("");
    setLoginCode(["", "", "", "", "", ""]);
    setLoginMessage("");
    setLoginError("");
    setIsLoginSubmitting(false);
    setCodeSendSource("manual");
  };

  const closeLoginPanel = () => {
    setIsLoginOpen(false);
    window.sessionStorage.removeItem(HOME_PROMPT_STORAGE_KEY);
    resetLoginForm();
  };

  const clearLoginFeedback = () => {
    setLoginError("");
    setLoginMessage("");
  };

  const closeLoginHistoryMenu = () => {
    setIsLoginHistoryOpen(false);
  };

  const rememberLoginEmail = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoginHistory((current) => {
      const next = [normalizedEmail, ...current.filter((item) => item !== normalizedEmail)].slice(0, MAX_LOGIN_HISTORY);
      try {
        window.localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const openWorkspaceUserDialog = (tab: HomeUserDialogTab) => {
    window.sessionStorage.setItem(WORKSPACE_USER_DIALOG_STORAGE_KEY, tab);
    openWorkspaceFresh();
  };

  const logoutUser = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setCurrentUser(null);
    setIsUserMenuOpen(false);
  };

  const submitHomePrompt = () => {
    const prompt = homePrompt.trim();

    if (!prompt) {
      if (currentUser) {
        openWorkspaceFresh();
        return;
      }

      window.sessionStorage.removeItem(HOME_PROMPT_STORAGE_KEY);
      resetLoginForm();
      setIsLoginOpen(true);
      return;
    }

    window.sessionStorage.setItem(HOME_PROMPT_STORAGE_KEY, prompt);

    if (currentUser) {
      openWorkspaceFresh();
      return;
    }

    resetLoginForm();
    setIsLoginOpen(true);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshCurrentUser(), 0);
    setHomeSite(getCurrentHomeSite(window.location.hostname));
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isHeroVideoReady) return;
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [isHeroVideoReady]);

  useEffect(() => {
    if (window.localStorage.getItem(HOME_VIDEO_CACHE_KEY) === "1") {
      setIsHeroVideoReady(true);
      return;
    }

    let cancelled = false;
    let hasSwitchedToVideo = false;
    const readyIndexes = new Set<number>();
    const preloadVideos: HTMLVideoElement[] = [];

    const preloadTimer = window.setTimeout(() => {
      heroSlides.forEach((slide, index) => {
        const video = document.createElement("video");
        preloadVideos.push(video);
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";

        const markReady = () => {
          if (cancelled) return;
          readyIndexes.add(index);

          if (!hasSwitchedToVideo) {
            hasSwitchedToVideo = true;
            setActiveHeroIndex(index);
            setIsHeroVideoReady(true);
            window.localStorage.setItem(HOME_VIDEO_CACHE_KEY, "1");
          }

          if (readyIndexes.size === heroSlides.length) {
            window.localStorage.setItem(HOME_VIDEO_CACHE_KEY, "1");
          }
        };

        video.addEventListener("canplaythrough", markReady, { once: true });
        video.addEventListener("loadeddata", markReady, { once: true });
        video.src = `${staticAssetUrl(slide.video)}?v=${homeAssetVersion}`;
        video.load();
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(preloadTimer);
      preloadVideos.forEach((video) => {
        video.removeAttribute("src");
        video.load();
      });
    };
  }, []);

  useEffect(() => {
    if (!isLoginHistoryOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (loginHistoryMenuRef.current?.contains(event.target as Node)) return;
      closeLoginHistoryMenu();
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isLoginHistoryOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current?.contains(event.target as Node)) return;
      setIsUserMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isUserMenuOpen]);

  const sendLoginCode = async (email: string, source: CodeSendSource = "manual") => {
    setCodeSendSource(source);
    await postJson<{ ok: boolean }>("/api/auth/send-code", { email });
    setLoginStep("code");
    setLoginCode(["", "", "", "", "", ""]);
    setLoginMessage(`验证码已发送至 ${email}`);
    window.setTimeout(() => codeInputRefs.current[0]?.focus(), 0);
  };

  const submitLoginEmail = async () => {
    const email = loginEmail.trim().toLowerCase();
    setLoginError("");
    setLoginMessage("");

    if (!isCompleteEmail(email)) {
      setLoginError("请输入完整邮箱");
      return;
    }

    setIsLoginSubmitting(true);
    try {
      if (loginMode === "code") {
        setLoginEmail(email);
        await sendLoginCode(email, "manual");
        return;
      }

      const result = await postJson<{ exists: boolean; hasPassword: boolean }>("/api/auth/check-email", { email });
      setLoginEmail(email);

      if (!result.exists || !result.hasPassword) {
        setLoginMode("code");
        await sendLoginCode(email, "auto");
        if (!result.exists) setLoginMessage(`该邮箱首次登录，验证码已发送至 ${email}`);
        if (result.exists && !result.hasPassword) setLoginMessage(`该邮箱还没有设置密码，验证码已发送至 ${email}`);
        return;
      }

      setLoginMode("password");
      setLoginStep("password");
      setLoginMessage("");
      window.setTimeout(() => document.getElementById("home-login-password")?.focus(), 0);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const submitPasswordLogin = async () => {
    setLoginError("");
    if (!loginPassword) {
      setLoginError("请输入密码");
      return;
    }

    setIsLoginSubmitting(true);
    try {
      await postJson("/api/auth/login-password", { email: loginEmail, password: loginPassword });
      rememberLoginEmail(loginEmail);
      openWorkspaceFresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const verifyLoginCode = async (nextCode = loginCode) => {
    const code = nextCode.join("");
    if (code.length !== 6 || isLoginSubmitting) return;

    setLoginError("");
    setIsLoginSubmitting(true);
    try {
      await postJson("/api/auth/verify-code", { email: loginEmail, code });
      rememberLoginEmail(loginEmail);
      openWorkspaceFresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "验证码登录失败");
      setLoginCode(["", "", "", "", "", ""]);
      window.setTimeout(() => codeInputRefs.current[0]?.focus(), 0);
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const updateLoginCodeDigit = (index: number, value: string) => {
    clearLoginFeedback();
    const digits = value.replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length > 1) {
      const nextCode = ["", "", "", "", "", ""];
      digits.forEach((digit, digitIndex) => {
        if (index + digitIndex < 6) nextCode[index + digitIndex] = digit;
      });
      setLoginCode(nextCode);
      const nextIndex = Math.min(index + digits.length, 5);
      window.setTimeout(() => codeInputRefs.current[nextIndex]?.focus(), 0);
      void verifyLoginCode(nextCode);
      return;
    }

    const nextCode = loginCode.map((digit, digitIndex) => (digitIndex === index ? digits[0] ?? "" : digit));
    setLoginCode(nextCode);
    if (digits[0] && index < 5) window.setTimeout(() => codeInputRefs.current[index + 1]?.focus(), 0);
    void verifyLoginCode(nextCode);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white" style={{ minHeight: "100vh", backgroundColor: "#000000", color: "#ffffff" }}>
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: isLoginOpen ? "translateX(-8vw)" : "translateX(0)", filter: isLoginOpen ? "blur(8px)" : undefined, transition: "transform 300ms ease-out, filter 300ms ease-out" }}
      >
        {isHeroVideoReady ? (
          <video
            key={activeHeroSlide.video}
            className="absolute inset-0 h-full w-full object-cover"
            src={`${staticAssetUrl(activeHeroSlide.video)}?v=${homeAssetVersion}`}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={() => setActiveHeroIndex((current) => (current + 1) % heroSlides.length)}
            onError={() => {
              window.localStorage.removeItem(HOME_VIDEO_CACHE_KEY);
              setIsHeroVideoReady(false);
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={activeHeroSlide.image}
            className="absolute inset-0 h-full w-full object-cover"
            src={`${staticAssetUrl(activeHeroSlide.image)}?v=${homeAssetVersion}`}
            alt="闪念首页轮播背景"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(88,130,255,0.28),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(62,211,218,0.2),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.78),rgba(0,0,0,0.42)_46%,rgba(0,0,0,0.72))]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34),transparent_34%,rgba(0,0,0,0.78))]" />
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.video}
              type="button"
              onClick={() => setActiveHeroIndex(index)}
              className={`h-1 rounded-full transition-all ${index === activeHeroIndex ? "w-8 bg-white/82" : "w-3 bg-white/28 hover:bg-white/46"}`}
              aria-label={`切换首页背景 ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div
        className="relative z-10 min-h-screen transition-transform duration-300 ease-out"
        style={{ transform: isLoginOpen ? "translateX(-8vw)" : "translateX(0)", filter: isLoginOpen ? "blur(8px)" : undefined, transition: "transform 300ms ease-out, filter 300ms ease-out" }}
      >
      <header className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <button type="button" onClick={() => window.location.assign(logoTargetUrl)} className="flex items-center gap-2.5 text-left" aria-label={logoTargetLabel} title={logoTargetLabel}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={staticAssetUrl("/home-assets/logo.png")} alt="闪念 FlashMuse" className="h-[50px] w-[50px] object-contain drop-shadow-[0_0_18px_rgba(116,166,255,0.38)]" />
          <span className="flex items-end gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={staticAssetUrl("/home-assets/logo-text.png")} alt="闪念" className="w-auto object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]" style={{ height: 30, filter: "brightness(0) invert(1)" }} />
            {showInternationalBadge ? <span className="pb-[1px] text-[11px] font-medium leading-none tracking-[0.02em] text-white/68">International</span> : null}
          </span>
        </button>
        <div className="flex items-center gap-3">
          {isAuthLoaded && currentUser ? (
            <>
            <Link href="/workspace" className="flex h-9 items-center rounded-full bg-white/10 px-5 font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:bg-white/18">
              <span style={{ fontSize: 13 }}>进入工作台</span>
            </Link>
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsUserMenuOpen((current) => !current);
                }}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/12 text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:bg-white/20"
                aria-label="打开用户菜单"
              >
                {currentUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentUser.avatarUrl} alt="用户头像" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[13px] font-medium" style={{ backgroundColor: defaultUserAvatar.backgroundColor, color: defaultUserAvatar.color }}>{defaultUserAvatar.label}</span>
                )}
              </button>
              {isUserMenuOpen ? (
                <div className="absolute right-0 top-12 z-40 w-[222px] overflow-hidden rounded-[12px] border border-white/18 bg-white pt-2 text-[#111111] shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
                  <button type="button" onClick={() => openWorkspaceUserDialog("profile")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiAccountCircleLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>用户信息</span>
                  </button>
                  <button type="button" onClick={() => openWorkspaceUserDialog("credits")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiVipDiamondLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>我的积分</span>
                  </button>
                  <button type="button" onClick={() => openWorkspaceUserDialog("security")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiShieldUserLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>帐号安全</span>
                  </button>
                  <button type="button" onClick={() => openWorkspaceUserDialog("settings")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                    <RiSettingsLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                    <span style={{ fontSize: 13 }}>设置</span>
                  </button>
                  <div className="mt-2 border-t border-[#e7e7e7] bg-[#f4f4f4]">
                    <button type="button" onClick={() => void logoutUser()} className="flex h-14 w-full items-center gap-3 px-3 text-left font-medium text-[#333333] transition hover:bg-[#eeeeee]">
                      <RiLogoutBoxRLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                      <span style={{ fontSize: 13 }}>退出登录</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.sessionStorage.removeItem(HOME_PROMPT_STORAGE_KEY);
                resetLoginForm();
                setIsLoginOpen(true);
              }}
              className="flex h-9 items-center rounded-full bg-white/10 px-5 font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:bg-white/18"
            >
              <span style={{ fontSize: 13 }}>登录</span>
            </button>
          )}
        </div>
      </header>

      <form
        className="absolute z-30"
        style={{ left: "50%", top: "50%", width: "100%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}
        onSubmit={(event) => {
          event.preventDefault();
          submitHomePrompt();
        }}
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
            background: "rgba(18, 22, 36, 0.34)",
            boxShadow: "0 24px 88px rgba(0,0,0,0.42), 0 8px 28px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.26)",
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
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-white transition hover:bg-white/18"
              aria-label="发送"
            >
              <RiArrowUpLine className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>
      </div>

      {isLoginOpen ? (
        <div className="fixed inset-0 z-50 overscroll-contain bg-black/18" onMouseDown={closeLoginPanel}>
          <aside
            className="absolute right-0 top-0 h-full bg-white text-[#111111] shadow-[-28px_0_80px_rgba(0,0,0,0.2)]"
            style={{ width: "min(33.333vw, 560px)", minWidth: 420, animation: "home-login-slide-in 0.22s ease-out" }}
            onMouseDown={(event) => {
              event.stopPropagation();
              if (!loginHistoryMenuRef.current?.contains(event.target as Node)) {
                closeLoginHistoryMenu();
              }
            }}
          >
            <button
              type="button"
              onMouseDown={(event) => {
                event.stopPropagation();
                closeLoginPanel();
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
                <img src={staticAssetUrl("/home-assets/logo.png")} alt="闪念 FlashMuse" className="h-[72px] w-[72px] object-contain" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={staticAssetUrl("/home-assets/logo-text.png")} alt="闪念" className="w-auto object-contain" style={{ height: 34 }} />
              </div>

              <form
                className="mt-12 w-full"
                style={{ maxWidth: 380 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (loginStep === "email") void submitLoginEmail();
                  if (loginStep === "password") void submitPasswordLogin();
                  if (loginStep === "code") void verifyLoginCode();
                }}
              >
                <div className="mb-5 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode("password");
                      setLoginStep("email");
                      setLoginCode(["", "", "", "", "", ""]);
                      setLoginPassword("");
                      setLoginError("");
                      setLoginMessage("");
                    }}
                    className={`font-medium transition hover:text-black ${loginMode === "password" ? "text-[#111111]" : "text-[#8a8a8a]"}`}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>密码登录</span>
                  </button>
                  <span className="h-3.5 w-px bg-[#d8d8d8]" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode("code");
                      setLoginStep("email");
                      setLoginCode(["", "", "", "", "", ""]);
                      setLoginPassword("");
                      setLoginError("");
                      setLoginMessage("");
                    }}
                    className={`font-medium transition hover:text-[#111111] ${loginMode === "code" ? "text-[#111111]" : "text-[#8a8a8a]"}`}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>验证码登录</span>
                  </button>
                </div>
                {loginStep === "email" ? (
                  <>
                    <div className="relative" ref={loginHistoryMenuRef}>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(event) => {
                          setLoginEmail(event.target.value);
                          clearLoginFeedback();
                          closeLoginHistoryMenu();
                        }}
                        onFocus={() => {
                          if (loginHistory.length > 0) setIsLoginHistoryOpen(true);
                        }}
                        onClick={() => {
                          if (loginHistory.length > 0) setIsLoginHistoryOpen(true);
                        }}
                        placeholder="请输入邮箱，如 name@email.com"
                        disabled={isLoginSubmitting}
                        className="h-16 w-full rounded-2xl border border-[#e3e3e3] bg-[#f7f7f7] pl-4 pr-11 text-[16px] leading-5 text-[#111111] outline-none transition placeholder:text-[#b0b0b0] hover:border-[#b9d2ff] focus:border-[#367cee] focus:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {canSubmitEmail ? (
                        <button type="button" onClick={() => void submitLoginEmail()} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[10px] text-[#8a8a8a] transition hover:bg-[#eeeeee] hover:text-[#333333]" aria-label="提交邮箱">
                          <RiCornerDownLeftLine className="h-5 w-5" aria-hidden="true" />
                        </button>
                      ) : null}
                      {isLoginHistoryOpen && loginHistory.length > 0 ? (
                        <div className="absolute left-0 right-0 top-[72px] z-20 max-h-[250px] overflow-y-auto rounded-[14px] bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)] ring-1 ring-[#ececec]">
                          {loginHistory.map((email) => (
                            <button
                              key={email}
                              type="button"
                              onClick={() => {
                                setLoginEmail(email);
                                clearLoginFeedback();
                                closeLoginHistoryMenu();
                              }}
                              className="flex h-10 w-full items-center rounded-[10px] px-3 text-left text-[#555555] transition hover:bg-[#f5f8ff] hover:text-[#111111]"
                            >
                              <span style={{ fontSize: 13, lineHeight: 1.2 }}>{email}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {loginMode === "code" && isLoginSubmitting ? (
                      <div className="mt-4 text-center text-[13px] leading-5 text-[#367cee]">
                        {codeSendSource === "auto" ? "首次登录或未设置密码，正在发送验证码" : "正在发送验证码"}
                        <span className="home-login-sending-dot">.</span>
                        <span className="home-login-sending-dot">.</span>
                        <span className="home-login-sending-dot">.</span>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {loginStep === "password" ? (
                  <>
                    <input
                      type="email"
                      value={loginEmail}
                      readOnly
                      className="h-16 w-full rounded-2xl border border-[#e3e3e3] bg-[#f7f7f7] px-4 text-[16px] text-[#666666] outline-none"
                    />
                    <div className="relative mt-3">
                      <input
                        id="home-login-password"
                        type="password"
                        value={loginPassword}
                        onChange={(event) => {
                          setLoginPassword(event.target.value);
                          clearLoginFeedback();
                        }}
                        placeholder="请输入密码"
                        disabled={isLoginSubmitting}
                        className="h-16 w-full rounded-2xl border border-[#e3e3e3] bg-[#f7f7f7] px-4 text-[16px] leading-5 text-[#111111] outline-none transition placeholder:text-[#b0b0b0] hover:border-[#b9d2ff] focus:border-[#367cee] focus:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoginSubmitting}
                      className="mt-3 h-16 w-full rounded-2xl bg-[#367cee] text-[15px] font-medium text-white transition hover:bg-[#1f63d9] disabled:cursor-not-allowed disabled:bg-[#a9c5fb]"
                    >
                      {isLoginSubmitting ? "登录中..." : "登录"}
                    </button>
                  </>
                ) : null}

                {loginStep === "code" ? (
                  <div className="flex h-16 w-full gap-2">
                    {loginCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          codeInputRefs.current[index] = element;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={digit}
                        disabled={isLoginSubmitting}
                        onChange={(event) => updateLoginCodeDigit(index, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Backspace" && !loginCode[index] && index > 0) {
                            codeInputRefs.current[index - 1]?.focus();
                          }
                        }}
                        className="h-16 min-w-0 flex-1 rounded-xl border border-[#e3e3e3] bg-[#f7f7f7] text-center text-[20px] font-medium text-[#111111] outline-none transition hover:border-[#b9d2ff] focus:border-[#367cee] focus:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    ))}
                  </div>
                ) : null}

                {loginMessage ? <div className="mt-3 text-center text-[12px] leading-5 text-[#8a8a8a]">{loginMessage}</div> : null}
                {loginError ? <div className="mt-3 text-center text-[12px] leading-5 text-red-500">{loginError}</div> : null}
                {loginStep === "code" ? (
                  <button
                    type="button"
                    disabled={isLoginSubmitting}
                    onClick={() => void sendLoginCode(loginEmail, "manual")}
                    className="mx-auto mt-3 block bg-transparent text-[12px] text-[#367cee] transition hover:text-[#1f63d9] disabled:cursor-not-allowed disabled:text-[#a9c5fb]"
                  >
                    重新获取验证码
                  </button>
                ) : null}
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
