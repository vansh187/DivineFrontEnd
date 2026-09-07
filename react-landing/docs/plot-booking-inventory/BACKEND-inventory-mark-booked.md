# Backend spec — mark a plot as booked once the booking amount is paid

**Owner:** Backend team
**Related frontend spec:** `FRONTEND-send-inventory-id.md`
**Problem:** After a plot booking is completed and the 10% booking amount is paid — by a
**customer** on the self-serve application, or by a **channel partner** collecting the
booking amount for a reserved lead — the inventory row is never updated. The plot keeps
`status = "available"` (or stays `reserved` until the 3-day hold lapses) and is shown to
the next buyer in `GET /inventory/search`. We need the paid plot to drop out of the
available pool permanently the instant the booking payment is confirmed (except for admin
repair).

---

## 1. Current behaviour (for context)

- `GET /inventory/search?status=available` is the only feed for the "Available plots"
  list (used by public, customer, and broker screens). The frontend also re-filters to
  `status === "available"` client-side.
- Channel-partner endpoints already move a unit out of the pool:
  - `POST /inventory/{id}/reserve` → `status = "reserved"` (3-day hold, partner only)
  - `POST /inventory/{id}/mark-sold` → `status = "sold"` (partner only)
  - `POST /inventory/{id}/release` → back to `available` (partner only)
- **Neither** booking flow marks a plot booked on payment:
  - **Customer:** `POST /payments/verify`, `POST /payments/cash` and
    `POST /documents/project-booking-application` are all called with **no inventory
    reference at all**.
  - **Channel partner:** `reserve` hides the plot for 3 days, but there is **no booking
    payment step** — `mark-sold` is a bare manual button with no money attached, and an
    un-actioned reservation silently frees up after 3 days.

---

## 2. Required changes

### 2.1 Inventory status model

Add a new terminal status value: **`booked`**.

| status      | meaning                                              | in `search` results? |
|-------------|-----------------------------------------------------|----------------------|
| `available` | free to book                                        | yes                  |
| `held`      | soft hold while a customer fills the form (§2.4)    | no                   |
| `reserved`  | channel-partner 3-day exclusive hold (existing)     | no                   |
| `booked`    | customer paid the booking amount (**new**)          | **no**               |
| `sold`      | fully sold / registered (existing)                  | no                   |

- `GET /inventory/search` must exclude `booked` (and `held`) exactly like it already
  excludes `reserved`/`sold`, both when `status` is passed and when it is omitted.
- Allowed transitions for the new flow:
  - `available → held` (soft hold, §2.4)
  - `available → booked` and `held → booked` — customer self-serve booking (§2.2)
  - `reserved → booked` — **only when the caller is the channel partner who holds the
    reservation** and they confirm the booking payment (§2.5)
  - `booked → available` only via an authenticated admin/repair action (cancellation,
    failed KYC, refund). Not exposed to customers or partners.
- Never allow `booked → booked`, `sold → booked`, or `reserved → booked` **by anyone other
  than the reserving partner**. Return `409 unit_not_available`.

### 2.2 Primary change — carry `inventory_id` on the payment (recommended)

The booking amount is paid via **either** Razorpay **or** cash — by the customer in
`CustomerApplicationPage`, or by the partner from their reserved lead (§2.5). That is the
moment the plot must be locked. The cleanest place to bind the plot is the payment record,
because both payment paths already hit the backend and settle server-side, and the same
two endpoints serve both roles.

**`POST /payments/create-order`** — accept two new optional fields:

```jsonc
// Request (application/json)
{
  "amount": 500000,
  "purpose": "plot_booking",           // NEW — enum: "plot_booking" | "other"
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b"   // NEW — inventory row id
}
```

```jsonc
// Response 200 — unchanged shape
{
  "payment_id": "pay_9Q...",
  "razorpay_order_id": "order_NQ...",
  "razorpay_key_id": "rzp_test_xxx",
  "amount": 500000,
  "amount_paise": 50000000,
  "currency": "INR",
  "status": "created"
}
```

Backend stores `inventory_id` + `purpose` on the payment row. Reject an unknown
`purpose` with `400 {"detail":"invalid_purpose"}`.

Both endpoints are called with the **same bearer token mechanism by customers and channel
partners** — no role gate on `purpose: "plot_booking"`; the inventory guard (§2.2 rules +
§2.5) decides whether the flip is allowed.

**On `POST /payments/verify` success** (signature verified) **and on
`POST /payments/cash` success**: if the payment row has `purpose = "plot_booking"` and an
`inventory_id`, transition that inventory row **in the same DB transaction** that marks the
payment settled:
- caller is the plot's holder / no hold exists → `available | held → booked`
- caller is a channel partner who holds the reservation → `reserved → booked`
- otherwise → conflict (see guard rules below)

`POST /payments/cash` also needs to accept `inventory_id` + `purpose` in its body:

```jsonc
// POST /payments/cash — Request (application/json)
{
  "amount": 500000,
  "note": "Cash recorded from booking application final page.",
  "purpose": "plot_booking",           // NEW
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b"   // NEW
}
```

Concurrency / guard rules for the flip:
- Use `SELECT ... FOR UPDATE`, then a conditional update:
  `UPDATE inventory SET status='booked', ... WHERE id=:id AND (status IN ('available','held') OR (status='reserved' AND reserved_by=:caller_id))`.
- If the row is already `booked` / `sold` / `held` by someone else / `reserved` by a
  **different** partner, **do not fail the payment** (the money is real). Instead: settle
  the payment, flag it `needs_manual_review = true` with reason `inventory_unavailable`,
  and return the payment record with an extra field so the frontend can warn the buyer:

```jsonc
// POST /payments/verify — Response 200 (conflict variant)
{
  "id": "pay_9Q...",
  "owner_id": "usr_...",
  "owner_role": "customer",
  "amount": 500000,
  "currency": "INR",
  "status": "paid",
  "method": "razorpay",
  "verified": true,
  "razorpay_order_id": "order_NQ...",
  "razorpay_payment_id": "rzp_pay_...",
  "created_date": "2026-09-08T10:34:12Z",
  "inventory_id": "b0e1f2a3-...",
  "inventory_status": "conflict",      // NEW — "booked" | "conflict"
  "inventory_conflict_reason": "unit_not_available"   // NEW — only when conflict
}
```

On the happy path:

```jsonc
// POST /payments/verify — Response 200 (success variant)
{
  "id": "pay_9Q...",
  "...": "... same as today ...",
  "verified": true,
  "inventory_id": "b0e1f2a3-...",
  "inventory_status": "booked"         // NEW
}
```

### 2.3 Safety-net field on the document upload

Even with §2.2 in place, also accept `inventory_id` as a **multipart form field** on:

**`POST /documents/project-booking-application`**

```
Content-Type: multipart/form-data

file:                <the generated PDF>
document_type:       project_booking_application
project_id:          ops-divine-greens
payment_id:          pay_9Q...
inventory_id:        b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b   <-- NEW (optional but sent)
razorpay_order_id:   order_NQ...        (present for online payments)
razorpay_payment_id: rzp_pay_...        (present for online payments)
form_data:           {...JSON...}
```

Behaviour: if `inventory_id` is present and the linked `payment_id` is verified and
belongs to the caller, ensure the inventory row is `booked` (idempotent — a no-op if
§2.2 already flipped it). This covers older payment rows created before `purpose` /
`inventory_id` were populated.

```jsonc
// Response 200 — add one field to the existing GeneratedDocument shape
{
  "id": "doc_7K...",
  "owner_id": "usr_...",
  "owner_role": "customer",
  "document_type": "project_booking_application",
  "status": "generated",
  "created_date": "2026-09-08T10:36:40Z",
  "signed_url": "https://storage.../doc_7K.pdf?sig=...",
  "signed_url_expires_in": 3600,
  "payment_plan": { "...": "..." },
  "inventory_id": "b0e1f2a3-...",       // NEW (echo back, nullable)
  "inventory_status": "booked"          // NEW ("booked" | "conflict" | null)
}
```

New `400` detail codes for this endpoint (frontend already has a generic handler and
will add labels):
- `inventory_not_found` — no such inventory row
- `inventory_project_mismatch` — `inventory_id` is not in `project_id`
- `409 unit_not_available` — row is `booked`/`sold`/`reserved` by someone else

### 2.4 Recommended — soft hold while the form is being filled (Phase 2)

Without a hold, two customers can both pay for the same plot within the same minute
(§2.2 then routes the loser to manual review, which is ugly). Add a short hold placed
when the customer opens the application with a chosen plot.

**`POST /inventory/{inventory_id}/hold`**  — auth: customer bearer token

```jsonc
// Request — empty body
```

```jsonc
// Response 200
{
  "id": "b0e1f2a3-...",
  "project_name": "OPS Divine Greens",
  "unit_number": "A-12",
  "status": "held",
  "held_by_me": true,
  "held_at": "2026-09-08T10:20:00Z",
  "held_until": "2026-09-08T10:50:00Z"   // e.g. 30-min TTL, auto-expires back to available
}
```

- `409 unit_not_available` if not `available` (or not held by the same caller).
- Hold auto-expires (cron or lazy check on read) back to `available`.
- `POST /inventory/{inventory_id}/release` (already exists for partners) should also let
  the holding customer drop their own hold — e.g. if they abandon the form.
- `held → booked` is allowed only for the same customer when their payment settles.

Reuse of the existing `reserved_at` / `reserved_until` columns is fine; just add a
`held_by` / `hold_kind` discriminator so partner reservations and customer holds don't
collide.

### 2.5 Channel-partner flow — `reserved → booked` on confirmed booking payment

Today a partner reserves a plot (`POST /inventory/{id}/reserve` → `reserved`, 3-day hold)
and later clicks "Mark sold". There is no booking payment in between. The frontend is
adding a **"Record booking payment"** action on the partner's reserved lead that calls the
same `POST /payments/create-order` + `POST /payments/verify` (online) or
`POST /payments/cash` (walk-in) with `purpose: "plot_booking"` and
`inventory_id = <the reserved plot>`.

Backend requirements:
- On that payment settling, apply the §2.2 flip: `reserved → booked`, **only if the
  reservation is held by the caller** (`inventory.reserved_by == payment.owner_id`).
  Otherwise return the conflict variant (§2.2) — do not fail the payment.
- On `reserved → booked`, clear `reserved_by` / `reserved_until` and set
  `booked_by` = the **end customer**. The partner id is already on the payment row; also
  store it on the inventory row as `booked_via_partner_id` for commission attribution
  (ties into the existing broker-commission work).
- **`POST /inventory/{id}/mark-sold` gains a precondition:** reject with
  `409 booking_payment_required` unless the row is already `booked` **or** a settled
  `plot_booking` payment exists for that `inventory_id`. This stops a plot being marked
  sold with no booking amount ever recorded. `sold` remains the final state
  (full payment / registration); `booked → sold` stays a partner/admin action.
- `POST /inventory/{id}/release` on a `reserved` (not yet `booked`) plot is unchanged
  (`reserved → available`). Releasing a `booked` plot is **not** allowed — use the admin
  `/unbook` (§ endpoint 8).

```jsonc
// POST /payments/cash — partner recording a walk-in booking
// Request (application/json), Authorization: Bearer <partner token>
{
  "amount": 500000,
  "note": "Booking amount for OPS Divine Greens Plot A-12 (channel partner).",
  "purpose": "plot_booking",
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b"
}
```

```jsonc
// Response 200
{
  "id": "pay_cash_71...",
  "owner_id": "usr_partner_55",
  "owner_role": "channel_partner",
  "amount": 500000,
  "currency": "INR",
  "status": "paid",
  "method": "cash",
  "verified": true,
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "inventory_status": "booked"
}
```

---

## 3. Endpoint summary (what the frontend will call)

| # | Method & path | Auth | Purpose | New fields |
|---|---------------|------|---------|-----------|
| 1 | `POST /payments/create-order` | customer **or** channel partner | start booking payment | body: `purpose`, `inventory_id` |
| 2 | `POST /payments/verify` | customer **or** channel partner | verify Razorpay + **flip plot to `booked`** (`available\|held → booked`, or `reserved → booked` for the reserving partner) | resp: `inventory_id`, `inventory_status`, `inventory_conflict_reason` |
| 3 | `POST /payments/cash` | customer **or** channel partner | record cash + **flip plot to `booked`** | body: `purpose`, `inventory_id`; resp: `inventory_status` |
| 4 | `POST /documents/project-booking-application` | customer | upload packet + idempotent booked check | form field: `inventory_id`; resp: `inventory_status` |
| 5 | `POST /inventory/{inventory_id}/hold` | customer | *(Phase 2)* soft-hold while filling form | new endpoint |
| 6 | `POST /inventory/{inventory_id}/release` | customer/partner | drop own hold / reservation (only when not yet `booked`) | extend existing to customers |
| 7 | `POST /inventory/{inventory_id}/mark-sold` | channel partner | `booked → sold` — **now requires a settled `plot_booking` payment** (else `409 booking_payment_required`) | new precondition |
| 8 | `POST /inventory/{inventory_id}/book` | **channel-partner (broker) token** — this backend has no admin role | manual repair: force a row to `booked` | new endpoint, admin only |
| 9 | `POST /inventory/{inventory_id}/unbook` | **channel-partner (broker) token** — this backend has no admin role | cancellation/refund: `booked → available` | new endpoint, admin only |

### 8. `POST /inventory/{inventory_id}/book` (admin repair)

```jsonc
// Request (application/json)
{ "payment_id": "pay_9Q...", "reason": "manual reconciliation" }
```

```jsonc
// Response 200
{
  "id": "b0e1f2a3-...",
  "status": "booked",
  "booked_at": "2026-09-08T10:40:00Z",
  "booked_payment_id": "pay_9Q..."
}
```

`409 unit_not_available` if already `booked`/`sold`.

### 9. `POST /inventory/{inventory_id}/unbook` (admin repair)

```jsonc
// Request (application/json)
{ "reason": "booking cancelled, refund processed" }
```

```jsonc
// Response 200
{ "id": "b0e1f2a3-...", "status": "available" }
```

---

## 4. Data model changes

`inventory` table:
- `status` — add `held`, `booked` to the allowed set.
- `booked_at TIMESTAMPTZ NULL`
- `booked_payment_id TEXT NULL` (FK → payments)
- `booked_by TEXT NULL` (FK → users) — the end customer
- `booked_via_partner_id TEXT NULL` (FK → users) — set when a channel partner recorded
  the booking payment; feeds commission attribution
- `held_by TEXT NULL`, `hold_kind TEXT NULL` (`'partner_reservation'` | `'customer_hold'`) if reusing `reserved_*`

`payments` table:
- `purpose TEXT NOT NULL DEFAULT 'other'` (`'plot_booking'` | `'other'`)
- `inventory_id TEXT NULL` (FK → inventory)
- `needs_manual_review BOOLEAN NOT NULL DEFAULT false`
- `manual_review_reason TEXT NULL`

---

## 5. Acceptance criteria

1. **Customer** books plot X, pays booking amount (Razorpay **or** cash) → plot X no longer
   appears in `GET /inventory/search` for any other user, immediately.
2. **Channel partner** reserves plot Y, then records its booking payment (Razorpay or cash)
   → plot Y transitions `reserved → booked`, stays out of search, and does **not** revert
   to `available` when the 3-day reservation window lapses.
3. `POST /inventory/{id}/mark-sold` on a plot with no settled `plot_booking` payment and
   status ≠ `booked` → `409 booking_payment_required`.
4. A second buyer (customer or a different partner) who tries to pay for an already-booked
   plot gets `inventory_status: "conflict"`; their payment is flagged for manual review,
   not silently lost.
5. Admin can reverse a booking (`/unbook`) and the plot returns to the available pool.
6. `booked` (and `held`) plots are excluded from search even when the `status` query param
   is omitted.
7. All status transitions are race-safe under concurrent requests (row lock / conditional
   update), including two partners racing on the same `reserved` plot.
