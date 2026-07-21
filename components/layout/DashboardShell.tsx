"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AccountSwitcher from "@/components/account/AccountSwitcher";

type Props = { children: React.ReactNode };

type PortfolioSidebarData = {
  summary?: {
    currentBalanceUsd?: number;
  };
};

const PORTFOLIO_BALANCE_EVENT = "stakk:portfolio-balance-loaded";

function initials(from: string): string {
  const base = (from || "").trim();
  if (!base) return "U";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const one = parts[0];
  if (one.includes("@")) return one.split("@")[0].slice(0, 2).toUpperCase();
  return one.slice(0, 2).toUpperCase();
}

function formatSidebarUsd(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardShell({ children }: Props) {
  const { data } = useSession();
  const pathname = usePathname();

  const displayName =
    data?.user?.name ??
    (data?.user?.email ? data.user.email.split("@")[0] : undefined) ??
    "Trader";
  const avatarText = initials(displayName);
  const isAdmin = !!data?.user?.isAdmin;

  const [openProfile, setOpenProfile] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tradingGroupOpen, setTradingGroupOpen] = useState(true);
  const [portfolioValueUsd, setPortfolioValueUsd] = useState<number | null>(
    null,
  );
  const [portfolioValueLoading, setPortfolioValueLoading] = useState(true);
  const portfolioPageValueSyncedRef = useRef(false);

  const tradingGroupActive =
    isActivePath(pathname, "/journal") || isActivePath(pathname, "/manage-tags");

  useEffect(() => {
    const stored = window.localStorage.getItem("stakk-sidebar-collapsed");
    if (stored) setSidebarCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPortfolioValue() {
      try {
        const res = await fetch("/api/portfolio", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;

        const payload = (await res.json()) as PortfolioSidebarData;
        const value = payload.summary?.currentBalanceUsd;
        if (
          !portfolioPageValueSyncedRef.current &&
          typeof value === "number" &&
          Number.isFinite(value)
        ) {
          setPortfolioValueUsd(value);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPortfolioValueUsd(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPortfolioValueLoading(false);
        }
      }
    }

    void fetchPortfolioValue();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function onPortfolioBalanceLoaded(event: Event) {
      const value = (event as CustomEvent<{ currentBalanceUsd?: number }>)
        .detail?.currentBalanceUsd;

      portfolioPageValueSyncedRef.current = true;
      setPortfolioValueLoading(false);
      if (typeof value === "number" && Number.isFinite(value)) {
        setPortfolioValueUsd(value);
      }
    }

    window.addEventListener(
      PORTFOLIO_BALANCE_EVENT,
      onPortfolioBalanceLoaded,
    );

    return () => {
      window.removeEventListener(
        PORTFOLIO_BALANCE_EVENT,
        onPortfolioBalanceLoaded,
      );
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenProfile(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setOpenProfile(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("stakk-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-dvh bg-[#F6F7FB] text-[#171821]">
      <button
        type="button"
        className="fixed left-4 top-4 z-[55] grid h-11 w-11 place-items-center rounded-[13px] border border-[#E7E8F0] bg-white text-[#171821] shadow-[0_10px_30px_rgba(35,21,76,0.08)] md:hidden"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
      >
        <MenuIcon />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#151220]/45 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-[#E7E8F0] bg-white transition-[transform,width] duration-200 ease-out md:z-40 ${
          sidebarCollapsed ? "md:w-[72px]" : "md:w-[252px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        aria-label="Primary navigation"
      >
        <div
          className={`flex h-[72px] items-center gap-3 overflow-hidden border-b border-[#E7E8F0] px-5 ${
            sidebarCollapsed ? "md:justify-center md:px-0" : ""
          }`}
        >
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3"
            aria-label="Stakk AI home"
            title="Stakk AI"
          >
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] bg-[linear-gradient(145deg,#6F39F4_10%,#A873FF_100%)] text-white shadow-[0_10px_22px_rgba(124,58,237,0.26)]">
              <BrandIcon />
            </span>
            <span
              className={`whitespace-nowrap text-xl font-black tracking-[-0.04em] ${
                sidebarCollapsed ? "md:hidden" : ""
              }`}
            >
              Stakk <span className="text-[#7C3AED]">AI</span>
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute right-[-14px] top-[88px] hidden h-7 w-7 place-items-center rounded-[9px] border border-[#E7E8F0] bg-white text-[#6F7283] shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:grid"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeftIcon
            className={`transition-transform ${
              sidebarCollapsed ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden px-[14px] py-[18px] ${
            sidebarCollapsed ? "md:px-2.5" : ""
          }`}
        >
          <div
            className={`mb-5 flex items-center gap-3 overflow-hidden rounded-[15px] border border-[#E4DBFB] bg-[linear-gradient(145deg,#FBF9FF_0%,#F5F0FF_100%)] p-3 shadow-[0_8px_20px_rgba(75,42,140,0.06)] ${
              sidebarCollapsed ? "md:justify-center md:p-[7px]" : ""
            }`}
          >
            <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border border-[#E8DEFC] bg-white text-[#7C3AED] shadow-[0_5px_14px_rgba(90,48,166,0.08)]">
              <BarsIcon />
            </span>
            <div
              className={`min-w-0 whitespace-nowrap ${
                sidebarCollapsed ? "md:hidden" : ""
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.08em] text-[#6F7283]">
                Portfolio Value
              </div>
              <div className="mt-1 text-lg font-black leading-none tracking-[-0.035em]">
                {portfolioValueLoading
                  ? "Loading..."
                  : (formatSidebarUsd(portfolioValueUsd) ?? "$0")}
              </div>
            </div>
          </div>

          <SidebarSection label="Overview" collapsed={sidebarCollapsed}>
            <NavItem
              href="/dashboard"
              label="Daily Analysis"
              icon={<HomeIcon />}
              collapsed={sidebarCollapsed}
              active={isActivePath(pathname, "/dashboard")}
            />
            <NavItem
              href="/portfolio"
              label="Portfolio Manager"
              icon={<PortfolioIcon />}
              collapsed={sidebarCollapsed}
              active={isActivePath(pathname, "/portfolio")}
            />
          </SidebarSection>

          <div>
            <NavGroup
              label="Short Term Trading"
              icon={<TrendIcon />}
              collapsed={sidebarCollapsed}
              open={tradingGroupOpen}
              setOpen={setTradingGroupOpen}
              active={tradingGroupActive}
            >
              <SubNavItem
                href="/journal"
                label="Trading Journal"
                active={isActivePath(pathname, "/journal")}
              />
              <SubNavItem
                href="/manage-tags"
                label="Manage Tags"
                active={isActivePath(pathname, "/manage-tags")}
              />
            </NavGroup>
          </div>

          <SidebarSection
            label="Settings"
            collapsed={sidebarCollapsed}
            className="mt-[18px]"
          >
            <ActionNavItem
              label="Accounts"
              icon={<AccountsIcon />}
              collapsed={sidebarCollapsed}
              onClick={() => setAccOpen(true)}
            />
            <NavItem
              href="/profile"
              label="My Profile"
              icon={<ProfileIcon />}
              collapsed={sidebarCollapsed}
              active={isActivePath(pathname, "/profile")}
            />
            {isAdmin && (
              <NavItem
                href="/admin"
                label="Admin"
                icon={<ShieldIcon />}
                collapsed={sidebarCollapsed}
                active={isActivePath(pathname, "/admin")}
              />
            )}
            {/*
            <NavItem
              href="/add-coin"
              label="Coin Tracker"
              icon={<SearchIcon />}
              collapsed={sidebarCollapsed}
              active={isActivePath(pathname, "/add-coin")}
            />
            */}
          </SidebarSection>
        </div>

        <div className="border-t border-[#E7E8F0] p-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenProfile((value) => !value)}
              className={`flex w-full items-center gap-3 rounded-[13px] px-2 py-2 text-left text-sm text-[#171821] transition-colors hover:bg-[#F7F7FB] ${
                sidebarCollapsed ? "md:justify-center md:px-0" : ""
              }`}
              aria-expanded={openProfile}
              aria-label="Open profile menu"
            >
              <span className="relative grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#B49BFF,#7C3AED)] text-[12px] font-extrabold text-white">
                {data?.user?.image ? (
                  <Image
                    src={data.user.image}
                    alt="avatar"
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  avatarText
                )}
              </span>
              <span
                className={`min-w-0 flex-1 ${
                  sidebarCollapsed ? "md:hidden" : ""
                }`}
              >
                <span className="block truncate font-extrabold">
                  {displayName}
                </span>
                <span className="block truncate text-xs font-semibold text-[#6F7283]">
                  {data?.user?.email ?? "Signed in"}
                </span>
              </span>
            </button>

            {openProfile && (
              <div
                className={`absolute bottom-full mb-2 w-64 rounded-2xl border border-[#E7E8F0] bg-white p-2 text-gray-800 shadow-xl ${
                  sidebarCollapsed ? "left-0 md:left-[52px]" : "left-0"
                }`}
                onMouseLeave={() => setOpenProfile(false)}
              >
                <div className="px-3 py-2 text-sm text-gray-500">
                  Hi, {displayName.split(" ")[0]}!
                </div>
                <MenuItem href="/profile" label="My profile" icon={<ProfileIcon />} />
                <button
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-gray-100"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogoutIcon /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main
        className={`min-w-0 px-4 pb-6 pt-[74px] transition-[margin] duration-200 ease-out md:px-6 md:py-7 ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-[252px]"
        }`}
      >
        {children}
      </main>

      {accOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px]"
          onClick={() => setAccOpen(false)}
        >
          <div
            className="fixed right-4 top-16 w-[460px] max-w-[95vw] rounded-2xl bg-white p-4 text-gray-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-semibold">Switch account</div>
              <button
                className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setAccOpen(false)}
                aria-label="Close"
                title="Close"
              >
                x
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

function SidebarSection({
  label,
  collapsed,
  className = "",
  children,
}: {
  label: string;
  collapsed: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div
        className={`mb-2 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#9A9CAD] ${
          collapsed ? "md:hidden" : ""
        }`}
      >
        {label}
      </div>
      <nav className="grid gap-[5px]">{children}</nav>
    </section>
  );
}

function NavItem({
  href,
  label,
  icon,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-bold transition-colors ${
        collapsed ? "md:mx-auto md:w-12 md:justify-center md:px-0" : ""
      } ${
        active
          ? "bg-[#F4EFFF] text-[#6127D9] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.06)] before:absolute before:bottom-[9px] before:left-0 before:top-[9px] before:w-[3px] before:rounded-r before:bg-[#7C3AED]"
          : "text-[#55596B] hover:bg-[#F7F7FB] hover:text-[#171821]"
      }`}
    >
      <span className="grid h-5 w-5 flex-none place-items-center">{icon}</span>
      <span
        className={`min-w-0 flex-1 truncate whitespace-nowrap ${
          collapsed ? "md:hidden" : ""
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

function ActionNavItem({
  label,
  icon,
  collapsed,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm font-bold text-[#55596B] transition-colors hover:bg-[#F7F7FB] hover:text-[#171821] ${
        collapsed ? "md:mx-auto md:w-12 md:justify-center md:px-0" : ""
      }`}
    >
      <span className="grid h-5 w-5 flex-none place-items-center">{icon}</span>
      <span
        className={`min-w-0 flex-1 truncate whitespace-nowrap ${
          collapsed ? "md:hidden" : ""
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function NavGroup({
  label,
  icon,
  collapsed,
  open,
  setOpen,
  active,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={collapsed ? label : undefined}
        aria-expanded={open}
        className={`relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm font-bold transition-colors ${
          collapsed ? "md:mx-auto md:w-12 md:justify-center md:px-0" : ""
        } ${
          active
            ? "bg-[#F4EFFF] text-[#6127D9] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.06)] before:absolute before:bottom-[9px] before:left-0 before:top-[9px] before:w-[3px] before:rounded-r before:bg-[#7C3AED]"
            : "text-[#55596B] hover:bg-[#F7F7FB] hover:text-[#171821]"
        }`}
      >
        <span className="grid h-5 w-5 flex-none place-items-center">{icon}</span>
        <span
          className={`min-w-0 flex-1 truncate whitespace-nowrap ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          {label}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 flex-none transition-transform ${
            open ? "rotate-180" : ""
          } ${collapsed ? "md:hidden" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`my-1 ml-[31px] grid gap-[3px] border-l border-[#E6DEF8] pl-[13px] ${
            collapsed ? "md:hidden" : ""
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function SubNavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex h-[38px] items-center rounded-[10px] px-2.5 text-[13px] font-semibold ${
        active
          ? "bg-[#F8F5FF] text-[#6127D9]"
          : "text-[#6F7283] hover:bg-[#F8F5FF] hover:text-[#6127D9]"
      }`}
    >
      {label}
    </Link>
  );
}

function MenuItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-100"
    >
      {icon} {label}
    </Link>
  );
}

function BrandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 8.7 12 4l7 4.7-2.7 8.1L12 20l-4.3-3.2L5 8.7Z"
        fill="currentColor"
        opacity=".96"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7.5h16M6 4h12l1 3.5H5L6 4Zm-1 3.5V20h14V7.5M9 12h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 17.5 9 12l3.5 3.5L20 7m-4 0h4v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 18V9m5 9V5m5 13v-7m5 7V3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function AccountsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 7h14M7 4h10l2 3H5l2-3Zm-2 3v13h14V7M9 12h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.5 12 11 13.5l3.5-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

// function SearchIcon() {
//   return (
//     <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
//       <path
//         d="m20 20-4.2-4.2M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
//         stroke="currentColor"
//         strokeLinecap="round"
//         strokeWidth="1.9"
//       />
//     </svg>
//   );
// }

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 6H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4M14 8l4 4-4 4M18 12H9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ChevronLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m14.5 6-6 6 6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
