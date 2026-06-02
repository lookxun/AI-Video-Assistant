"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const ADMIN_LOGIN_HISTORY_KEY = "flashmuse-admin-login-history-v1";
const MAX_ADMIN_LOGIN_HISTORY = 5;

export function AdminLoginForm({ hasAdminEmails, initialMessage = "" }: { hasAdminEmails: boolean; initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loginMode, setLoginMode] = useState<"password" | "code">("password");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [message, setMessage] = useState(initialMessage || (hasAdminEmails ? "" : "尚未配置 ADMIN_EMAILS 管理员白名单"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginHistory, setLoginHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(ADMIN_LOGIN_HISTORY_KEY);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, MAX_ADMIN_LOGIN_HISTORY) : [];
    } catch {
      return [];
    }
  });
  const [isLoginHistoryOpen, setIsLoginHistoryOpen] = useState(false);
  const loginHistoryMenuRef = useRef<HTMLDivElement | null>(null);

  function closeLoginHistoryMenu() {
    setIsLoginHistoryOpen(false);
  }

  function rememberLoginEmail(value: string) {
    const normalizedEmail = value.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoginHistory((current) => {
      const next = [normalizedEmail, ...current.filter((item) => item !== normalizedEmail)].slice(0, MAX_ADMIN_LOGIN_HISTORY);
      try {
        window.localStorage.setItem(ADMIN_LOGIN_HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (!isLoginHistoryOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (loginHistoryMenuRef.current?.contains(event.target as Node)) return;
      closeLoginHistoryMenu();
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isLoginHistoryOpen]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(loginMode === "password" ? "/api/admin/login-password" : "/api/admin/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginMode === "password" ? { email, password } : { email, code }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(typeof result.error === "string" ? result.error : "登录失败");
        return;
      }

      rememberLoginEmail(email);
      window.location.reload();
    } catch {
      setMessage("请求失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendCode() {
    if (isSubmitting) return;

    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(typeof result.error === "string" ? result.error : "验证码发送失败");
        return;
      }

      setHasSentCode(true);
      setMessage("验证码已发送，请查看邮箱");
    } catch {
      setMessage("请求失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <form onSubmit={submitLogin} className="w-full max-w-[360px] rounded-[18px] border border-[#eeeeee] bg-white p-7 shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
        <div className="mb-7 text-center">
          <div className="flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home-assets/logo.png" alt="闪念" className="h-[30px] w-[30px] object-contain" />
            <div className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">闪念后台</div>
          </div>
          <div className="mt-2 text-[13px] text-[#888888]">管理员白名单登录</div>
        </div>

        <label className="mb-1.5 block text-[13px] font-medium text-[#555555]">邮箱</label>
        <div className="relative mb-4" ref={loginHistoryMenuRef}>
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setMessage("");
              closeLoginHistoryMenu();
            }}
            onFocus={() => {
              if (loginHistory.length > 0) setIsLoginHistoryOpen(true);
            }}
            onClick={() => {
              if (loginHistory.length > 0) setIsLoginHistoryOpen(true);
            }}
            type="email"
            autoComplete="email"
            placeholder="请输入管理员邮箱"
            className="h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] px-3 text-[14px] outline-none transition focus:border-[#367cee] focus:bg-white"
          />
          {isLoginHistoryOpen && loginHistory.length > 0 ? (
            <div className="absolute left-0 right-0 top-[50px] z-20 max-h-[220px] overflow-y-auto rounded-[12px] bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)] ring-1 ring-[#ececec]">
              {loginHistory.map((historyEmail) => (
                <button
                  key={historyEmail}
                  type="button"
                  onClick={() => {
                    setEmail(historyEmail);
                    setMessage("");
                    closeLoginHistoryMenu();
                  }}
                  className="flex h-10 w-full items-center rounded-[9px] px-3 text-left text-[#555555] transition hover:bg-[#f5f8ff] hover:text-[#111111]"
                >
                  <span style={{ fontSize: 13, lineHeight: 1.2 }}>{historyEmail}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {loginMode === "password" ? (
          <>
            <label className="mb-1.5 block text-[13px] font-medium text-[#555555]">密码</label>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" className="h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] px-3 text-[14px] outline-none transition focus:border-[#367cee] focus:bg-white" />
          </>
        ) : (
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-[13px] font-medium text-[#555555]">验证码</label>
              <button type="button" onClick={() => void sendCode()} disabled={isSubmitting || !hasAdminEmails} className="text-[#367cee] disabled:text-[#b5b5b5]">
                <span style={{ fontSize: 12 }}>{hasSentCode ? "重新发送" : "发送验证码"}</span>
              </button>
            </div>
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="请输入6位验证码" className="h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] px-3 text-[14px] outline-none transition focus:border-[#367cee] focus:bg-white" />
          </>
        )}

        {message ? <div className="mt-3 text-[13px] leading-5 text-red-500">{message}</div> : null}

        <button type="submit" disabled={isSubmitting || !hasAdminEmails} className="mt-6 h-11 w-full rounded-[10px] bg-[#111111] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#cfcfcf]">
          <span style={{ fontSize: 14 }}>{isSubmitting ? (loginMode === "password" ? "正在登录..." : "正在验证...") : "进入后台"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setLoginMode((current) => (current === "password" ? "code" : "password"));
            setMessage("");
          }}
          className="mt-4 h-8 w-full text-[#666666] transition hover:text-[#111111]"
        >
          <span style={{ fontSize: 13 }}>{loginMode === "password" ? "没有密码，使用验证码登录" : "使用密码登录"}</span>
        </button>
      </form>
    </main>
  );
}
