import { navLinks } from '../data/navigation';
import { loginOptions } from '../data/loginOptions';
import { contact } from '../data/contact';
import { company } from '../data/company';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-hairline-dark bg-chrome px-6 pb-8 pt-12 sm:px-10">
      <div className="grid grid-cols-1 gap-8 border-b border-hairline-dark pb-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div>
          <div className="font-display text-lg font-bold text-white">Divine Vision</div>
          <p className="mt-3.5 max-w-[28ch] text-sm text-white/70">{company.tagline}</p>
        </div>

        <div>
          <h5 className="eyebrow-label mb-3.5 block text-terracotta">Explore</h5>
          <ul className="flex flex-col gap-2.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-sm text-white/70 transition-colors hover:text-terracotta">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="eyebrow-label mb-3.5 block text-terracotta">Account</h5>
          <ul className="flex flex-col gap-2.5">
            {loginOptions.map((option) => (
              <li key={option.href}>
                <a href={option.href} className="text-sm text-white/70 transition-colors hover:text-terracotta">
                  {option.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="eyebrow-label mb-3.5 block text-terracotta">Contact</h5>
          <ul className="flex flex-col gap-2.5">
            <li>
              <a href={contact.phoneHref} className="text-sm text-white/70 transition-colors hover:text-terracotta">
                {contact.phone}
              </a>
            </li>
            <li>
              <a href={contact.emailHref} className="text-sm text-white/70 transition-colors hover:text-terracotta">
                {contact.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h5 className="eyebrow-label mb-3.5 block text-terracotta">Where we build</h5>
          <ul className="flex flex-col gap-2.5">
            {company.locations.map((location) => (
              <li key={location} className="text-sm text-white/70">
                {location}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-4">
        <div className="eyebrow-label text-[10px] text-white/55">
          {company.legalName} · Est. {company.foundedYear}
        </div>
        <div className="eyebrow-label text-[10px] text-white/55">
          {company.compliance.join(' · ')}
        </div>
        <div className="eyebrow-label text-[10px] text-white/55">
          © {year} All rights reserved.
        </div>
      </div>
    </footer>
  );
}
