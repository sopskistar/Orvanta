"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "./brand";

const links = [{ href: "/services/", label: "Services" }, { href: "/demo/", label: "The demo" }, { href: "/contact/", label: "Contact" }];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);
  return <header className="site-header"><div className="container header-inner">
    <Link href="/" aria-label="Orvanta home" onClick={() => setOpen(false)}><Brand /></Link>
    <button ref={toggle} className="menu-toggle" aria-expanded={open} aria-controls="primary-nav" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}<span className={open ? "menu-lines is-open" : "menu-lines"} aria-hidden="true"><i /><i /></span></button>
    <nav id="primary-nav" aria-label="Main navigation" className={open ? "main-nav is-open" : "main-nav"}>
      {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href || `${pathname}/` === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <Link href="/contact/" className="nav-cta" onClick={() => setOpen(false)}>Discuss your setup</Link>
    </nav>
  </div></header>;
}
