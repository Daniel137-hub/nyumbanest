"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  Heart,
  House,
  List,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";

const propertyLinks = [
  { label: "All Properties", href: "/properties" },
  { label: "Buy", href: "/buy" },
  { label: "Rent", href: "/rent" },
  { label: "Land", href: "/land" },
  { label: "Commercial", href: "/commercial" },
];

function ProfileAvatar({ avatarUrl }: { avatarUrl: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!avatarUrl || failedUrl === avatarUrl) {
    return <UserRound size={21} aria-hidden="true" />;
  }

  return (
    <Image
      className="profile-button__image"
      src={avatarUrl}
      width={40}
      height={40}
      alt=""
      unoptimized
      onError={() => setFailedUrl(avatarUrl)}
    />
  );
}

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="NyumbaNest home">
      <span className="brand__mark">
        <House aria-hidden="true" className="brand__icon" strokeWidth={2.7} />
      </span>
      <span>NyumbaNest</span>
    </Link>
  );
}

function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const menuItems = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
  const currentIndex = menuItems.findIndex((item) => item === document.activeElement);
  let nextIndex: number | undefined;

  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % menuItems.length;
  if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = menuItems.length - 1;

  if (nextIndex !== undefined && menuItems.length > 0) {
    event.preventDefault();
    menuItems[nextIndex]?.focus();
  }
}

function PropertyMenu({
  id,
  onNavigate,
}: {
  id: string;
  onNavigate: () => void;
}) {
  return (
    <div
      className="property-menu"
      id={id}
      role="menu"
      aria-label="Property categories"
      onKeyDown={handleMenuKeyDown}
    >
      {propertyLinks.map(({ label, href }) => (
        <Link key={href} href={href} role="menuitem" tabIndex={0} onClick={onNavigate}>
          {label}
        </Link>
      ))}
    </div>
  );
}

export function MarketplaceNavigationClient({
  avatarUrl,
  isAdmin = false,
}: {
  avatarUrl: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const propertyButtonRef = useRef<HTMLButtonElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePropertiesButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement>(null);
  const [openDropdown, setOpenDropdown] = useState<"properties" | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [areMobilePropertiesOpen, setAreMobilePropertiesOpen] = useState(false);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !navigationRef.current?.contains(event.target)) {
        setOpenDropdown(null);
        setIsMobileMenuOpen(false);
        setAreMobilePropertiesOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      const hasOpenMenu = openDropdown !== null || isMobileMenuOpen || areMobilePropertiesOpen;
      if (!hasOpenMenu) return;

      event.preventDefault();
      if (areMobilePropertiesOpen && window.matchMedia("(max-width: 820px)").matches) {
        setAreMobilePropertiesOpen(false);
        mobilePropertiesButtonRef.current?.focus();
        return;
      }

      setOpenDropdown(null);
      setIsMobileMenuOpen(false);
      setAreMobilePropertiesOpen(false);
      lastTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [areMobilePropertiesOpen, isMobileMenuOpen, openDropdown]);

  const propertiesAreActive = propertyLinks.some(({ href }) => pathname === href);
  const homeIsActive = pathname === "/";

  function closeMenus() {
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);
    setAreMobilePropertiesOpen(false);
  }

  function toggleProperties() {
    lastTriggerRef.current = propertyButtonRef.current;
    setOpenDropdown((open) => open === "properties" ? null : "properties");
  }

  function toggleMobileMenu() {
    lastTriggerRef.current = hamburgerButtonRef.current;
    setIsMobileMenuOpen((open) => !open);
    setAreMobilePropertiesOpen(false);
    setOpenDropdown(null);
  }

  function toggleMobileProperties(button: HTMLButtonElement) {
    mobilePropertiesButtonRef.current = button;
    lastTriggerRef.current = button;
    setAreMobilePropertiesOpen((open) => !open);
  }

  return (
    <header className="marketplace-navigation" ref={navigationRef}>
      <div className="desktop-header">
        <div className="desktop-header__left"><Brand /></div>
        <nav className="desktop-header__links" aria-label="Main navigation">
          <Link href="/" aria-current={homeIsActive ? "page" : undefined}>Home</Link>
          <div className="navigation-dropdown">
            <button
              ref={propertyButtonRef}
              className="navigation-dropdown__trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={openDropdown === "properties"}
              aria-controls={openDropdown === "properties" ? "desktop-properties-menu" : undefined}
              aria-current={propertiesAreActive ? "page" : undefined}
              onClick={toggleProperties}
            >
              Properties <ChevronDown size={16} aria-hidden="true" />
            </button>
            {openDropdown === "properties" ? (
              <PropertyMenu id="desktop-properties-menu" onNavigate={closeMenus} />
            ) : null}
          </div>
          <Link href="/my-listings" aria-current={pathname.startsWith("/my-listings") ? "page" : undefined}>
            My Listings
          </Link>
          <Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined}>Pricing</Link>
          {isAdmin ? <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined}>Admin</Link> : null}
        </nav>
        <div className="desktop-header__right">
          <Link
            className="profile-button"
            href="/profile"
            aria-label="Open your profile"
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <ProfileAvatar avatarUrl={avatarUrl} />
          </Link>
        </div>
      </div>

      <div className="mobile-header">
        <Brand />
        <div className="mobile-header__actions">
          <Link
            className="profile-button"
            href="/profile"
            aria-label="Open your profile"
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <ProfileAvatar avatarUrl={avatarUrl} />
          </Link>
          <button
            ref={hamburgerButtonRef}
            className="icon-button mobile-header__toggle"
            type="button"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav
        className="mobile-menu"
        id="mobile-menu"
        aria-label="Mobile main navigation"
        hidden={!isMobileMenuOpen}
      >
        <Link href="/" onClick={closeMenus} aria-current={homeIsActive ? "page" : undefined}>Home</Link>
        <button
          className="mobile-menu__disclosure"
          type="button"
          ref={mobilePropertiesButtonRef}
          aria-expanded={areMobilePropertiesOpen}
          aria-controls={areMobilePropertiesOpen ? "mobile-properties-menu" : undefined}
          onClick={(event) => toggleMobileProperties(event.currentTarget)}
        >
          Properties <ChevronDown size={16} aria-hidden="true" />
        </button>
        {areMobilePropertiesOpen ? (
          <div className="mobile-menu__categories" id="mobile-properties-menu">
            {propertyLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenus}
                aria-current={pathname === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </div>
        ) : null}
        <Link href="/my-listings" onClick={closeMenus} aria-current={pathname.startsWith("/my-listings") ? "page" : undefined}>
          My Listings
        </Link>
        <Link href="/pricing" onClick={closeMenus} aria-current={pathname === "/pricing" ? "page" : undefined}>Pricing</Link>
        {isAdmin ? <Link href="/admin" onClick={closeMenus} aria-current={pathname.startsWith("/admin") ? "page" : undefined}>Admin</Link> : null}
      </nav>
    </header>
  );
}

export function MobileBottomNavigation({
  activeItem,
}: {
  activeItem?: "Home" | "Search" | "Saved" | "Listings" | "Profile";
}) {
  const items = [
    { label: "Home", href: "/", icon: House },
    { label: "Search", href: "/search", icon: Search },
    { label: "Saved", href: "/saved", icon: Heart },
    { label: "Listings", href: "/my-listings", icon: List },
    { label: "Profile", href: "/profile", icon: UserRound },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile shortcuts">
      {items.map(({ label, href, icon: Icon }) => (
        <Link
          className="mobile-bottom-nav__item"
          key={label}
          href={href}
          aria-current={label === activeItem ? "page" : undefined}
        >
          <Icon size={19} strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
