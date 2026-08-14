import { useScrolled } from '../hooks/useScrolled';
import { navLinks } from '../data/navigation';
import { contact } from '../data/contact';
import { LoginMenu } from './LoginMenu';

export function Navbar() {
  const scrolled = useScrolled(50);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-[90] flex items-center justify-between bg-chrome px-6 py-4 transition-shadow duration-300 sm:px-10 ${
        scrolled ? 'shadow-[0_12px_30px_rgba(43,46,40,0.18)]' : 'shadow-none'
      }`}
    >
      <a href="/" className="font-display shrink-0 text-lg font-bold text-white">
        Divine Vision
      </a>

      <div className="flex items-center gap-7">
        <div className="hidden gap-6 sm:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="eyebrow-label text-xs text-white/85 transition-colors hover:text-terracotta-light"
            >
              {link.label}
            </a>
          ))}
        </div>

        <LoginMenu />

        <a
          href={contact.phoneHref}
          className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-chrome shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-green hover:text-white hover:shadow-[0_10px_24px_-10px_rgba(56,142,60,0.7)]"
        >
          Book a site visit
        </a>
      </div>
    </nav>
  );
}
