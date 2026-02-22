"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AccountSwitcher from "@/components/account/AccountSwitcher";

type Props = { children: React.ReactNode };

function initials(from: string): string {
  const base = (from || "").trim();
  if (!base) return "U";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const one = parts[0];
  if (one.includes("@")) return one.split("@")[0].slice(0, 2).toUpperCase();
  return one.slice(0, 2).toUpperCase();
}

export default function DashboardShell({ children }: Props) {
  const { data } = useSession();
  const displayName =
    data?.user?.name ??
    (data?.user?.email ? data.user.email.split("@")[0] : undefined) ??
    "Trader";

  const avatarText = initials(displayName);
  const isAdmin = !!data?.user?.isAdmin;

  const [openProfile, setOpenProfile] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [tradingGroupOpen, setTradingGroupOpen] = useState(true);
  const [portfolioGroupOpen, setPortfolioGroupOpen] = useState(true);

  const pathname = usePathname();

  const openComingSoon = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setCourseOpen(true);
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 88);
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const tradingGroupActive =
    pathname === "/journal" ||
    pathname === "/strategies" ||
    pathname === "/trade-analyzer";

  const portfolioGroupActive =
    pathname === "/portfolio" || pathname === "/exit-strategy";

  const topNavLinkBase =
    "text-sm px-3 py-2 rounded-xl transition-colors whitespace-nowrap";
  const topNavInactive = "text-[#6B6777] hover:bg-white";
  const topNavActive = "bg-[#F1EAFE] text-[#7C3AED] font-semibold";

  const isTopActive = (href: string) => pathname === href;

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#E9E6F2] text-[#14121A]">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3">
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 min-w-0">
              <Link
                href="/"
                className="flex items-center gap-3"
                aria-label="Stakk AI – Home"
                title="Stakk AI"
              >
                <div className="h-9 w-9 rounded-[12px] bg-[radial-gradient(circle_at_30%_30%,#B49BFF,#7C3AED)] shadow-[0_10px_22px_rgba(124,58,237,0.25)] relative overflow-hidden">
                  <div className="absolute inset-[9px] rounded-[10px] bg-white/70 rotate-[14deg] [clip-path:polygon(0_40%,55%_0,100%_40%,55%_100%)]" />
                </div>
                <span className="font-extrabold tracking-[0.02em] text-[18px]">
                  Stakk <b className="text-[#7C3AED] font-extrabold">AI</b>
                </span>
              </Link>

              <nav
                className="hidden lg:flex items-center gap-2 text-[14px]"
                aria-label="Primary navigation"
              >
                <Link
                  href="/dashboard"
                  className={`${topNavLinkBase} ${
                    isTopActive("/dashboard") ? topNavActive : topNavInactive
                  }`}
                >
                  Home
                </Link>
                <Link
                  href="/journal"
                  className={`${topNavLinkBase} ${
                    isTopActive("/journal") ? topNavActive : topNavInactive
                  }`}
                >
                  Trading Journal
                </Link>
                <Link
                  href="/strategies"
                  className={`${topNavLinkBase} ${
                    isTopActive("/strategies") ? topNavActive : topNavInactive
                  }`}
                >
                  Strategy Creator
                </Link>
                <Link
                  href="/exit-strategy"
                  className={`${topNavLinkBase} ${
                    isTopActive("/exit-strategy")
                      ? topNavActive
                      : topNavInactive
                  }`}
                >
                  Exit Strategy
                </Link>
                <Link
                  href="/trade-analyzer"
                  className={`${topNavLinkBase} ${
                    isTopActive("/trade-analyzer")
                      ? topNavActive
                      : topNavInactive
                  }`}
                >
                  Trade Analyzer
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`${topNavLinkBase} ${
                      isTopActive("/admin") ? topNavActive : topNavInactive
                    }`}
                  >
                    Admin
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAccOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#E9E6F2] bg-white px-3 py-2 text-[13px] text-[#6B6777] shadow-[0_6px_16px_rgba(20,18,26,0.04)] cursor-pointer"
                title="Switch account"
              >
                <span className="text-[#6D28D9] font-black text-base">⎈</span>
                <span>Accounts</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setOpenProfile((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-[#E9E6F2] bg-white px-3 py-2 text-[13px] text-[#14121A] shadow-[0_6px_16px_rgba(20,18,26,0.04)] cursor-pointer"
                >
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#B49BFF] to-[#7C3AED] grid place-items-center overflow-hidden relative text-[11px] font-extrabold text-white">
                    {data?.user?.image ? (
                      <Image
                        src={data.user.image}
                        alt="avatar"
                        fill
                        className="object-cover"
                        sizes="28px"
                      />
                    ) : (
                      avatarText
                    )}
                  </span>
                  <span className="hidden sm:inline font-semibold truncate max-w-[140px]">
                    {displayName}
                  </span>
                </button>

                {openProfile && (
                  <div
                    className="absolute right-0 mt-2 w-64 bg-white text-gray-800 rounded-2xl shadow-xl p-2 z-50 border border-gray-100"
                    onMouseLeave={() => setOpenProfile(false)}
                  >
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Hi, {displayName.split(" ")[0]}!
                    </div>
                    <MenuItem href="/profile" label="My profile" emoji="🙋‍♂️" />

                    <button
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 cursor-pointer"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                      <span className="text-lg">🚪</span> Logout
                    </button>
                  </div>
                )}
              </div>

              <button
                className="inline-flex lg:hidden flex-col items-center justify-center rounded-full border border-[#E9E6F2] bg-white p-2 shadow-[0_6px_16px_rgba(20,18,26,0.04)] cursor-pointer"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                <span className="block h-0.5 w-5 bg-[#14121A] mb-1.5 rounded-full" />
                <span className="block h-0.5 w-5 bg-[#14121A] mb-1.5 rounded-full" />
                <span className="block h-0.5 w-5 bg-[#14121A] rounded-full" />
              </button>
            </div>

            {mobileOpen && (
              <>
                <div
                  className="fixed inset-0 z-[45] bg-black/30 lg:hidden"
                  onClick={() => setMobileOpen(false)}
                />
                <div
                  id="mobile-nav"
                  className="absolute left-0 right-0 top-full z-50 lg:hidden border-t border-[#E9E6F2] bg-gradient-to-b from-white via-[#F7F4FF] to-[#EFE9FF] backdrop-blur shadow-[0_18px_40px_rgba(20,18,26,0.22)] rounded-b-2xl"
                >
                  <div className="mx-auto max-w-7xl px-4 md:px-6 py-3">
                    <ul className="grid gap-2 text-sm animate-[fadeDown_160ms_ease-out]">
                      <li>
                        <Link
                          href="/dashboard"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all ${
                            isTopActive("/dashboard")
                              ? "border-transparent bg-[#F1EAFE] text-[#4C1D95] shadow-[0_10px_24px_rgba(124,58,237,0.16)]"
                              : "border-transparent text-[#14121A] hover:bg-white/80 hover:border-[#E3DEF7]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/80 grid place-items-center text-lg">
                              🏠
                            </span>
                            <span className="font-medium">Home</span>
                          </div>
                          <span className="text-xs text-[#9C92D4]">
                            {isTopActive("/dashboard") ? "Current" : ""}
                          </span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/journal"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all ${
                            isTopActive("/journal")
                              ? "border-transparent bg-[#F1EAFE] text-[#4C1D95] shadow-[0_10px_24px_rgba(124,58,237,0.16)]"
                              : "border-transparent text-[#14121A] hover:bg-white/80 hover:border-[#E3DEF7]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/80 grid place-items-center text-lg">
                              🗒️
                            </span>
                            <span className="font-medium">Trading Journal</span>
                          </div>
                          <span className="text-xs text-[#9C92D4]">
                            {isTopActive("/journal") ? "Current" : ""}
                          </span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/strategies"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all ${
                            isTopActive("/strategies")
                              ? "border-transparent bg-[#F1EAFE] text-[#4C1D95] shadow-[0_10px_24px_rgba(124,58,237,0.16)]"
                              : "border-transparent text-[#14121A] hover:bg-white/80 hover:border-[#E3DEF7]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/80 grid place-items-center text-lg">
                              🧭
                            </span>
                            <span className="font-medium">
                              Strategy Creator
                            </span>
                          </div>
                          <span className="text-xs text-[#9C92D4]">
                            {isTopActive("/strategies") ? "Current" : ""}
                          </span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/exit-strategy"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all ${
                            isTopActive("/exit-strategy")
                              ? "border-transparent bg-[#F1EAFE] text-[#4C1D95] shadow-[0_10px_24px_rgba(124,58,237,0.16)]"
                              : "border-transparent text-[#14121A] hover:bg-white/80 hover:border-[#E3DEF7]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/80 grid place-items-center text-lg">
                              🚪
                            </span>
                            <span className="font-medium">Exit Strategy</span>
                          </div>
                          <span className="text-xs text-[#9C92D4]">
                            {isTopActive("/exit-strategy") ? "Current" : ""}
                          </span>
                        </Link>
                      </li>

                      <li>
                        <Link
                          href="/trade-analyzer"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all ${
                            isTopActive("/trade-analyzer")
                              ? "border-transparent bg-[#F1EAFE] text-[#4C1D95] shadow-[0_10px_24px_rgba(124,58,237,0.16)]"
                              : "border-transparent text-[#14121A] hover:bg-white/80 hover:border-[#E3DEF7]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full bg-white/80 grid place-items-center text-lg">
                              📈
                            </span>
                            <span className="font-medium">Trade Analyzer</span>
                          </div>
                          <span className="text-xs text-[#9C92D4]">
                            {isTopActive("/trade-analyzer") ? "Current" : ""}
                          </span>
                        </Link>
                      </li>

                      {isAdmin && (
                        <li>
                          <Link
                            href="/admin"
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition-all ${
                              isTopActive("/admin")
                                ? "border-transparent bg-[#F1EAFE] text-[#4C1D95] shadow-[0_10px_24px_rgba(124,58,237,0.16)]"
                                : "border-transparent text-[#14121A] hover:bg-white/80 hover:border-[#E3DEF7]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-8 w-8 rounded-full bg-white/80 grid place-items-center text-lg">
                                🛡️
                              </span>
                              <span className="font-medium">Admin</span>
                            </div>
                            <span className="text-xs text-[#9C92D4]">
                              {isTopActive("/admin") ? "Current" : ""}
                            </span>
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl md:max-w-none px-4 md:px-6 py-6 relative">
        <aside
          className={`hidden md:block fixed left-0 bottom-0 z-40 transition-all duration-300 ease-in-out bg-white shadow-lg ${
            isScrolled ? "top-0" : "top-[88px]"
          }`}
          onMouseEnter={() => setSidebarExpanded(true)}
          style={{
            width: sidebarExpanded ? "260px" : "64px",
          }}
        >
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {sidebarExpanded && (
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex justify-end z-10">
                <button
                  onClick={() => setSidebarExpanded(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                  title="Close sidebar"
                  aria-label="Close sidebar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="px-3 pt-4 pb-3 flex justify-center">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 grid place-items-center text-white text-base font-semibold flex-shrink-0 overflow-hidden relative">
                {data?.user?.image ? (
                  <Image
                    src={data.user.image}
                    alt="avatar"
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  avatarText
                )}
              </div>
            </div>

            <nav className="px-2 pb-4">
              <ul className="grid gap-1">
                <NavItem
                  href="/dashboard"
                  label="Home"
                  icon="🏠"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />

                <NavGroup
                  href="/portfolio"
                  label="Portfolio Manager"
                  icon="💼"
                  showText={sidebarExpanded}
                  pathname={pathname}
                  open={portfolioGroupOpen}
                  setOpen={setPortfolioGroupOpen}
                  isActiveGroup={portfolioGroupActive}
                >
                  <NavChildItem
                    href="/exit-strategy"
                    label="Exit Strategy Simulator"
                    icon="🚪"
                    showText={sidebarExpanded}
                    pathname={pathname}
                  />
                </NavGroup>

                <NavGroup
                  href="/journal"
                  label="Trading Journal"
                  icon="🗒️"
                  showText={sidebarExpanded}
                  pathname={pathname}
                  open={tradingGroupOpen}
                  setOpen={setTradingGroupOpen}
                  isActiveGroup={tradingGroupActive}
                >
                  <NavChildItem
                    href="/strategies"
                    label="Strategy Creator"
                    icon="🧭"
                    showText={sidebarExpanded}
                    pathname={pathname}
                  />
                  <NavChildItem
                    href="/trade-analyzer"
                    label="Trade Analyzer"
                    icon="📈"
                    showText={sidebarExpanded}
                    pathname={pathname}
                  />
                </NavGroup>

                {isAdmin && (
                  <NavItem
                    href="/admin"
                    label="Admin"
                    icon="🛡️"
                    showText={sidebarExpanded}
                    pathname={pathname}
                  />
                )}

                <NavItem
                  href="/add-coin"
                  label="Coin Tracker"
                  icon="🔍"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
              </ul>
            </nav>
          </div>
        </aside>

        <main
          className={`min-w-0 transition-all duration-300 ease-in-out ${
            sidebarExpanded ? "md:ml-[260px]" : "md:ml-[64px]"
          }`}
        >
          {children}
        </main>
      </div>

      {courseOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] grid place-items-center"
          onClick={() => setCourseOpen(false)}
        >
          <div
            className="w-[440px] max-w-[92vw] rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-2">Coming soon…</div>
            <p className="text-sm text-gray-600">
              Our Trading Course is almost ready. Stay tuned! 🚀
            </p>
            <div className="mt-4 text-right">
              <button
                className="rounded-xl bg-black text-white px-4 py-2 cursor-pointer"
                onClick={() => setCourseOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {accOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px]"
          onClick={() => setAccOpen(false)}
        >
          <div
            className="fixed right-4 top-16 w-[460px] max-w-[95vw] rounded-2xl bg-white text-gray-800 shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="font-semibold">Switch account</div>
              <button
                className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-100 cursor-pointer"
                onClick={() => setAccOpen(false)}
                aria-label="Close"
                title="Close"
              >
                ✖
              </button>
            </div>

            <div className="pt-3">
              <AccountSwitcher onClose={() => setAccOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  showText = true,
  pathname,
}: {
  href: string;
  label: string;
  icon: string;
  showText?: boolean;
  pathname?: string;
}) {
  const isActive = pathname === href;

  return (
    <li>
      <Link
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
          isActive
            ? "bg-purple-50 text-purple-700"
            : "text-gray-700 hover:bg-gray-50"
        }`}
        href={href}
        title={!showText ? label : undefined}
      >
        <span className="w-5 text-center flex-shrink-0 text-lg">{icon}</span>
        <span
          className="whitespace-nowrap text-sm font-medium overflow-hidden transition-all duration-300"
          style={{
            width: showText ? "auto" : "0",
            opacity: showText ? 1 : 0,
          }}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}

function NavGroup({
  href,
  label,
  icon,
  showText,
  pathname,
  open,
  setOpen,
  isActiveGroup,
  children,
}: {
  href: string;
  label: string;
  icon: string;
  showText: boolean;
  pathname?: string;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isActiveGroup: boolean;
  children: React.ReactNode;
}) {
  const isActive = pathname === href;

  return (
    <li className="select-none">
      <div className="flex items-center">
        <Link
          href={href}
          title={!showText ? label : undefined}
          className={`flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
            isActive
              ? "bg-purple-50 text-purple-700"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <span className="w-5 text-center flex-shrink-0 text-lg">{icon}</span>

          <span
            className="whitespace-nowrap text-sm font-medium overflow-hidden transition-all duration-300"
            style={{
              width: showText ? "auto" : "0",
              opacity: showText ? 1 : 0,
            }}
          >
            {label}
          </span>
        </Link>

        {showText && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className={`ml-1 h-10 w-10 grid place-items-center rounded-lg transition-colors ${
              isActiveGroup ? "text-purple-700" : "text-gray-500"
            } hover:bg-gray-50`}
            aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
            title={open ? "Collapse" : "Expand"}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {showText && open && <ul className="mt-1 grid gap-1">{children}</ul>}
    </li>
  );
}

function NavChildItem({
  href,
  label,
  icon,
  showText = true,
  pathname,
}: {
  href: string;
  label: string;
  icon: string;
  showText?: boolean;
  pathname?: string;
}) {
  const isActive = pathname === href;

  return (
    <li>
      <Link
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ml-6 ${
          isActive
            ? "bg-purple-50 text-purple-700"
            : "text-gray-700 hover:bg-gray-50"
        }`}
        href={href}
        title={!showText ? label : undefined}
      >
        <span className="w-5 text-center flex-shrink-0 text-lg">{icon}</span>
        <span className="whitespace-nowrap text-sm font-medium">{label}</span>
      </Link>
    </li>
  );
}

function MenuItem({
  href,
  label,
  emoji,
}: {
  href: string;
  label: string;
  emoji: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100"
    >
      <span className="text-lg">{emoji}</span> {label}
    </Link>
  );
}
