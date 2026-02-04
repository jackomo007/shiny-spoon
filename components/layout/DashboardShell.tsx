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

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

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

  return (
    <div className="min-h-dvh bg-gray-50">
      <div
        className="relative text-gray-700"
        style={{ backgroundColor: "#f6f1ff" }}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6 relative">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Stakk AI – Home"
              title="Stakk AI"
            >
              <span
                className="font-extrabold leading-none tracking-tight"
                style={{
                  fontSize: 24,
                  color: "#0F1220",
                }}
              >
                Stakk
              </span>

              <span style={{ width: 6, display: "inline-block" }} />

              <span
                className="font-extrabold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r"
                style={{
                  fontSize: 24,
                  backgroundImage:
                    "linear-gradient(90deg, #6D28D9 0%, #A855F7 100%)",
                }}
              >
                AI
              </span>
            </Link>

            <nav className="hidden xl:flex items-center gap-6 opacity-90">
              <Link href="/dashboard">Home</Link>
              <Link href="/journal">Trading Journal</Link>
              <Link href="/strategies">Strategy Creator</Link>
              <Link href="/exit-strategy">Exit Strategy</Link>
              <Link href="/trade-analyzer">Trade Analyzer</Link>
              {isAdmin && <Link href="/admin">Admin</Link>}
            </nav>

            <button
              className="inline-flex flex-col items-center justify-center rounded-full bg-white/15 p-2 hover:bg-white/20 xl:hidden cursor-pointer"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              <span className="block h-0.5 w-5 bg-gray-700 mb-1.5" />
              <span className="block h-0.5 w-5 bg-gray-700 mb-1.5" />
              <span className="block h-0.5 w-5 bg-gray-700" />
            </button>

            {mobileOpen && (
              <>
                <div
                  className="fixed inset-0 z-[45] bg-black/30 xl:hidden"
                  onClick={() => setMobileOpen(false)}
                />
                <div
                  id="mobile-nav"
                  className="absolute left-0 right-0 top-full z-50 xl:hidden border-t border-white/20 backdrop-blur-sm"
                  style={{ backgroundColor: "#f6f1ff" }}
                >
                  <div className="mx-auto max-w-7xl px-6 py-3">
                    <ul className="grid gap-2 text-gray-700 animate-[fadeDown_160ms_ease-out]">
                      <li>
                        <Link
                          href="/dashboard"
                          className="block rounded-xl px-3 py-2 hover:bg-white/20"
                          onClick={() => setMobileOpen(false)}
                        >
                          Home
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/journal"
                          className="block rounded-xl px-3 py-2 hover:bg-white/20"
                          onClick={() => setMobileOpen(false)}
                        >
                          Trading Journal
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/strategies"
                          className="block rounded-xl px-3 py-2 hover:bg-white/20"
                          onClick={() => setMobileOpen(false)}
                        >
                          Strategy Creator
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/exit-strategy"
                          className="block rounded-xl px-3 py-2 hover:bg-white/20"
                          onClick={() => setMobileOpen(false)}
                        >
                          Exit Strategy
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/trade-analyzer"
                          className="block rounded-xl px-3 py-2 hover:bg-white/20"
                          onClick={() => setMobileOpen(false)}
                        >
                          Trade Analyzer
                        </Link>
                      </li>
                      {isAdmin && (
                        <li>
                          <Link
                            href="/admin"
                            className="block rounded-xl px-3 py-2 hover:bg-white/20"
                            onClick={() => setMobileOpen(false)}
                          >
                            Admin
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAccOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/20 cursor-pointer"
              title="Switch account"
            >
              <span>👥</span> Accounts
            </button>

            <div className="relative">
              <button
                onClick={() => setOpenProfile((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/20 cursor-pointer"
              >
                <span className="h-8 w-8 rounded-full bg-white/20 grid place-items-center overflow-hidden relative">
                  {data?.user?.image ? (
                    <Image
                      src={data.user.image}
                      alt="avatar"
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    avatarText
                  )}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </button>

              {openProfile && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white text-gray-800 rounded-2xl shadow-xl p-2 z-50"
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
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl md:max-w-none px-4 md:px-6 py-6 relative">
        {/* Sidebar com toggle + hover */}
        <aside
          className="hidden md:block fixed left-0 top-[88px] bottom-0 z-40 transition-all duration-300 ease-in-out bg-white shadow-lg"
          onMouseEnter={() => setSidebarExpanded(true)}
          style={{
            width: sidebarExpanded ? "260px" : "64px",
          }}
        >
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {/* Botão X para fechar - aparece quando expandida */}
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

            {/* Avatar do usuário - apenas o círculo */}
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

            {/* Menu de navegação */}
            <nav className="px-2 pb-4">
              <ul className="grid gap-1">
                <NavItem
                  href="/dashboard"
                  label="Home"
                  icon="🏠"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
                <NavItem
                  href="/portfolio"
                  label="Portfolio Manager"
                  icon="💼"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
                <NavItem
                  href="/journal"
                  label="Trading Journal"
                  icon="🗒️"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
                <NavItem
                  href="/strategies"
                  label="Strategy Creator"
                  icon="🧭"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
                <NavItem
                  href="/exit-strategy"
                  label="Exit Strategy"
                  icon="🚪"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
                <NavItem
                  href="/trade-analyzer"
                  label="Trade Analyzer"
                  icon="📈"
                  showText={sidebarExpanded}
                  pathname={pathname}
                />
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
