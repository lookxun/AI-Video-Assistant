"use client";

export function AdminLogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    window.location.reload();
  }

  return (
    <button type="button" onClick={() => void logout()} className="mt-3 h-9 w-full rounded-[9px] border border-[#e5e5e5] bg-white text-[#333333] transition hover:bg-[#f3f3f3]">
      <span style={{ fontSize: 13 }}>退出后台</span>
    </button>
  );
}
