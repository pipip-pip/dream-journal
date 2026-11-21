"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "🌙", label: "Tonight" },
  { href: "/journal", icon: "📖", label: "Journal" },
  { href: "/people", icon: "👥", label: "People" },
  { href: "/fragments", icon: "🗝️", label: "Fragments" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <span aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
