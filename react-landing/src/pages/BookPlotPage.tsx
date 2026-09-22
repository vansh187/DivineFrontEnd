import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvailablePlotsList } from '../components/AvailablePlotsList';
import { useAuth } from '../hooks/useAuth';
import type { InventoryUnit } from '../services/inventoryApi';

// A unit the visitor picked while signed out. Stashed here so that after they
// log in (the AuthModal sends them to their dashboard) the booking can carry on
// from where they left off.
const PENDING_UNIT_KEY = 'dvi_pending_book_unit';

// Only resume a stashed booking if the login happened shortly after the visitor
// picked the plot — so returning to this page days later just browses normally.
const PENDING_UNIT_TTL_MS = 15 * 60 * 1000;

function stashPendingUnit(unit: InventoryUnit) {
  try {
    sessionStorage.setItem(PENDING_UNIT_KEY, JSON.stringify({ unit, at: Date.now() }));
  } catch {
    // storage disabled / private mode — the visitor just re-picks after login
  }
}

function readPendingUnit(): InventoryUnit | null {
  try {
    const raw = sessionStorage.getItem(PENDING_UNIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { unit: InventoryUnit; at: number };
    if (!parsed?.unit || typeof parsed.at !== 'number' || Date.now() - parsed.at > PENDING_UNIT_TTL_MS) {
      return null;
    }
    return parsed.unit;
  } catch {
    return null;
  }
}

function clearPendingUnit() {
  try {
    sessionStorage.removeItem(PENDING_UNIT_KEY);
  } catch {
    /* ignore */
  }
}

export function BookPlotPage() {
  const navigate = useNavigate();
  const { session, openModal } = useAuth();

  // Continue a booking that was started before signing in.
  useEffect(() => {
    if (!session) return;
    const pending = readPendingUnit();
    if (!pending) return;
    clearPendingUnit();
    if (session.role === 'customer') {
      navigate('/customer', { state: { unit: pending } });
    } else {
      navigate('/broker/plots');
    }
  }, [session, navigate]);

  const handleBook = (unit: InventoryUnit) => {
    if (!session) {
      // Gate the booking behind login — the visitor chooses Customer or
      // Channel Partner inside the modal.
      stashPendingUnit(unit);
      openModal('signin', 'customer');
      return;
    }
    if (session.role === 'customer') {
      // Documents (Aadhaar, PAN, photo) are collected on the customer dashboard
      // before the application form will accept a booking, so hand the unit off
      // there rather than jumping straight to the application.
      navigate('/customer', { state: { unit } });
      return;
    }
    // Channel partners reserve / schedule visits from their plots workspace.
    navigate('/broker/plots');
  };

  return (
    <>
      <main className="bg-bg px-4 pb-20 pt-28 sm:px-10 sm:pt-32">
        <section className="mx-auto max-w-6xl">
          <p className="eyebrow-label text-terracotta">Available plots</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.45fr)] lg:items-end">
            <h1 className="font-display text-balance text-4xl font-bold leading-tight text-ink sm:text-6xl">
              Browse &amp; book plots across our townships.
            </h1>
            <p className="text-[15px] leading-[1.75] text-ink-muted">
              Every plot currently available across Suraksha Enclave, OPS Divine Greens and our
              other NH-1 corridor townships. Filter by size or block, then start a booking —
              you&rsquo;ll sign in as a customer or channel partner before it&rsquo;s confirmed.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl">
          <AvailablePlotsList actionLabel="Book Plot" onAction={handleBook} />
        </section>
      </main>
    </>
  );
}
