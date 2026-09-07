# Backend spec — instalment payments, "Pay now" window & payment-due reminders

**Owner:** Backend team
**Related:** `BACKEND-inventory-mark-booked.md` (booking + `payment_plan`), `FRONTEND-send-inventory-id.md`
**Frontend status:** the customer app already renders the full plan as a table with a
per-row **Pay now** button and shows a home-page "payment due" banner, driven off
`GET /customer/profile` → `booking.payment_schedule` (falling back to the plan cached from
the application upload). It needs the backend to (a) accept an instalment payment and mark
the milestone paid, (b) stamp per-row `status` / `pay_enabled_from` on the schedule, and
(c) run the 20-day email reminder.

---

## 1. Background — what the frontend does today

- On a confirmed booking, `POST /documents/project-booking-application` returns
  `payment_plan` — `On Booking` (paid) + four milestones at **+45 / +90 / +180 / +270
  days**, splitting the total consideration **10 / 15 / 25 / 25 / 25** (rows foot exactly
  to the total; `On Booking` = the 10% already paid).
- The customer profile page shows every milestone with a **Pay now** button that unlocks
  **5 days before** that milestone's due date (`PAY_WINDOW_DAYS = 5`), and only for the
  **earliest unpaid** milestone.
- The customer home shows a **payment-due banner** starting **20 days before** the next
  unpaid milestone's due date (`REMINDER_LEAD_DAYS = 20`), turning red once overdue.
- The frontend computes the 5-day and 20-day windows itself from `due_date`, so it works
  even before the backend changes land — but **status, ordering enforcement, the email,
  and marking milestones paid are backend-only.**

---

## 2. Required changes

### 2.1 Accept an instalment payment

`POST /payments/create-order` and `POST /payments/cash` already take `purpose` +
`inventory_id` (see `BACKEND-inventory-mark-booked.md`). Add a third purpose and two
fields.

**`POST /payments/create-order`** — auth: customer bearer token

```jsonc
// Request (application/json)
{
  "amount": 266146,                 // must equal the milestone amount (see §2.4)
  "purpose": "installment",         // NEW enum value
  "installment_no": 2,              // NEW — 1-based position in payment_schedule
  "due_date": "2025-02-24"          // NEW — that milestone's ISO due date (echo for matching)
}
```

```jsonc
// Response 200 — unchanged shape
{
  "payment_id": "b7e2c1a0-1111-2222-3333-444455556666",
  "razorpay_order_id": "order_NQabc123",
  "razorpay_key_id": "rzp_test_xxx",
  "amount": 266146,
  "amount_paise": 26614600,
  "currency": "INR",
  "status": "created"
}
```

`POST /payments/cash` takes the same three new fields in its body.

Backend stores `purpose`, `installment_no`, `due_date` on the payment row and resolves
them to a specific `payment_schedule` milestone for the caller's booking (match on
`installment_no`; use `due_date` as a sanity check).

**Guard rails — reject before creating the order (400, `{ "detail": "<code>" }`):**

| code | when |
|------|------|
| `installment_not_found` | no milestone at `installment_no` for this customer's booking |
| `installment_already_paid` | that milestone is already `paid` |
| `installment_out_of_order` | an earlier milestone is still unpaid |
| `installment_not_payable` | `today < due_date − 5 days` (window not open yet) |
| `installment_amount_mismatch` | `amount` ≠ the milestone amount (allow ±1 for rounding) |
| `no_booking` | the customer has no booked plot / no payment plan |

The same checks run again inside `POST /payments/verify` / `POST /payments/cash` at settle
time (order + settle can be minutes apart), returning the same codes.

### 2.2 On settle — mark the milestone paid

Inside the same transaction that marks the payment settled (`POST /payments/verify`
signature OK, or `POST /payments/cash`):

1. Set that `payment_schedule` milestone `status = "paid"`, record `paid_on`,
   `paid_payment_id`.
2. Recompute `amount_received` and outstanding for the booking.
3. Recompute `status` for the remaining milestones (§2.3).

Add three fields to the payment record the frontend already reads back:

```jsonc
// POST /payments/verify — Response 200 (installment variant)
{
  "id": "b7e2c1a0-1111-2222-3333-444455556666",
  "owner_id": "C00007",
  "owner_role": "customer",
  "amount": 266146,
  "currency": "INR",
  "status": "paid",
  "method": "razorpay",
  "verified": true,
  "razorpay_order_id": "order_NQabc123",
  "razorpay_payment_id": "pay_NQxyz789",
  "created_date": "2025-02-20T09:12:44Z",
  "purpose": "installment",             // NEW echo
  "installment_no": 2,                  // NEW echo
  "installment_status": "paid"          // NEW — "paid" | "rejected"
}
```

On a guard-rail failure at settle time the money is real: settle the payment, set
`installment_status: "rejected"`, flag `needs_manual_review = true` with
`manual_review_reason` = the guard code, and return the record (do **not** 4xx). The
frontend surfaces "payment received, our team will reconcile it."

### 2.3 Enrich `GET /customer/profile` → `booking.payment_schedule`

Each row gains three fields (all optional to the FE, but please send them):

```jsonc
{
  "id": "m2",                       // NEW — stable milestone id
  "label": "Within 45 days of booking",
  "percent": 15,
  "due_days": 45,
  "due_date": "2025-02-24",         // resolve against booking_date
  "amount": 266146,
  "status": "due",                  // NEW — "paid" | "due" | "overdue" | "upcoming"
  "pay_enabled_from": "2025-02-19"  // NEW — due_date − 5 days
}
```

`status`, server-computed against **today** (Asia/Kolkata):

| status | rule |
|--------|------|
| `paid` | milestone settled |
| `overdue` | not paid and `today > due_date` |
| `due` | not paid and `due_date − 20 days ≤ today ≤ due_date` |
| `upcoming` | not paid and `today < due_date − 20 days` |

Rows stay in schedule order. `amount_received` and any outstanding total must stay
consistent with the per-row `status`.

> The FE re-derives the same status/window from `due_date` if these fields are missing, so
> partial rollout is safe — but the email in §2.5 needs the server-side computation anyway.

### 2.4 Amount rules (must match what the customer sees)

- Milestone amounts = `round(total_consideration × percent/100)`, with the **last row
  adjusted** so the column foots exactly to `total_consideration`.
- `On Booking` (10%) is the booking amount already paid — always `status: "paid"`.
- The "Pay now" button and every reminder must quote **exactly** the milestone `amount`.
- If `total_consideration` is later corrected, recompute unpaid milestone amounts; never
  change a `paid` row.

### 2.5 Payment-due email — 20 days before (required)

A scheduled job (daily, early morning Asia/Kolkata).

For every customer with a booked plot and an unpaid next milestone `M` (earliest unpaid):

- **Trigger:** `0 ≤ (M.due_date − today) ≤ 20` **or** `M` is overdue.
- **Idempotency:** a `payment_reminders` row `(customer_id, milestone_id, kind, sent_at)`.
  Send each `kind` once. Recommended `kind`s:
  - `T_MINUS_20` — **required** (the ask)
  - `T_MINUS_5` — when the Pay-now window opens (recommended)
  - `DUE_TODAY` — on the due date (recommended)
  - `OVERDUE` — weekly while overdue (recommended)
- **Email content (all values from the plan, not free-typed):**
  - customer name, project + plot (`unit_number`)
  - milestone label (e.g. "Within 90 days of booking")
  - **amount due** = `M.amount` (formatted `₹ 4,43,576`)
  - **due date** = `M.due_date` (e.g. `10 Apr 2025`)
  - days remaining / "overdue by N days"
  - total outstanding after this milestone
  - CTA link → `https://<app>/customer/profile#payments`
  - support phone / email
- **Subject:** `Payment due — ₹4,43,576 for OPS Divine Greens Plot 204 by 10 Apr 2025`
- Send to `customer.email`; BCC the sales inbox if desired.
- Log every send (audit + dedupe). A bounce/failure must not block the next day's run.

Optional but recommended: also expose the reminder state so support can see it —
`GET /customer/profile` could include `booking.next_due`:

```jsonc
"next_due": {
  "milestone_id": "m3",
  "label": "Within 90 days of booking",
  "amount": 443576,
  "due_date": "2025-04-10",
  "days_until_due": 12,          // negative when overdue
  "status": "due",
  "last_reminder_kind": "T_MINUS_20",
  "last_reminder_at": "2025-03-29T04:30:00Z"
}
```

The frontend does **not** require `next_due` (it computes the banner from the schedule),
but it will use it if present.

### 2.6 Server-side enforcement of the 5-day window & ordering

Even though the UI hides the button, `POST /payments/create-order` **and** the settle
step must enforce:

- `today ≥ pay_enabled_from` (= `due_date − 5 days`) → else `installment_not_payable`
- all earlier milestones `paid` → else `installment_out_of_order`
- milestone not already `paid` → else `installment_already_paid`

(Allowing a customer to pay a *later* instalment early is a product decision — default
**no**, enforce order. If you want to allow prepayment, drop `installment_out_of_order`
and the FE can be opened up too.)

---

## 3. Endpoint summary

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/payments/create-order` | body: `purpose:"installment"`, `installment_no`, `due_date`; new 400 codes (§2.1) |
| `POST` | `/payments/verify` | on settle: mark milestone paid + recompute; resp += `purpose`, `installment_no`, `installment_status` |
| `POST` | `/payments/cash` | same body + settle behaviour as above |
| `GET`  | `/customer/profile` | `booking.payment_schedule[]` rows += `id`, `status`, `pay_enabled_from`; optional `booking.next_due` |
| —      | scheduled job | daily 20-day (+ optional 5-day / due-day / overdue) payment-due email |

### Sample — pay instalment 3 online

```http
POST /payments/create-order
Authorization: Bearer <customer token>
Content-Type: application/json

{ "amount": 443576, "purpose": "installment", "installment_no": 3, "due_date": "2025-04-10" }
```
```jsonc
// 200
{ "payment_id": "…", "razorpay_order_id": "order_…", "razorpay_key_id": "rzp_…",
  "amount": 443576, "amount_paise": 44357600, "currency": "INR", "status": "created" }
```
```http
POST /payments/verify
Authorization: Bearer <customer token>
Content-Type: application/json

{ "razorpay_order_id": "order_…", "razorpay_payment_id": "pay_…", "razorpay_signature": "…" }
```
```jsonc
// 200
{
  "id": "…", "status": "paid", "verified": true,
  "amount": 443576, "method": "razorpay",
  "purpose": "installment", "installment_no": 3, "installment_status": "paid"
}
```

### Sample — window not open yet

```jsonc
// POST /payments/create-order → 400
{ "detail": "installment_not_payable" }
```

---

## 4. Data model

`payment_schedule` (per booking milestone) — new columns:
- `id` (stable, e.g. `<booking_id>-m<n>`)
- `status` — `paid | due | overdue | upcoming`
- `paid_on TIMESTAMPTZ NULL`, `paid_payment_id TEXT NULL`
- (derived, may be virtual) `pay_enabled_from = due_date − interval '5 days'`

`payments` — new columns:
- `installment_no INT NULL`
- `due_date DATE NULL`
- (`purpose`, `needs_manual_review`, `manual_review_reason` already added for booking)

`payment_reminders` (new):
- `id`, `customer_id`, `booking_id`, `milestone_id`
- `kind` — `T_MINUS_20 | T_MINUS_5 | DUE_TODAY | OVERDUE`
- `amount`, `due_date`
- `sent_at TIMESTAMPTZ`, `email_to`, `delivery_status`
- unique `(milestone_id, kind)` for `T_MINUS_20 / T_MINUS_5 / DUE_TODAY`; `OVERDUE` may repeat weekly (include an ISO week in the key).

---

## 5. Acceptance criteria

1. Booking done + 10% paid → profile shows 5 rows; `On Booking` = `paid`, rest `due` /
   `upcoming` per §2.3, amounts foot to the total consideration.
2. `Pay now` on the next milestone is accepted only within 5 days of its due date;
   earlier attempt → `installment_not_payable`.
3. Paying milestone N via Razorpay or cash marks it `paid`, bumps `amount_received`, and
   advances the next milestone — reflected on the next `GET /customer/profile`.
4. Trying to pay milestone N+1 while N is unpaid → `installment_out_of_order`.
5. Paying an already-paid milestone → `installment_already_paid`.
6. 20 days before a milestone's due date, exactly one `T_MINUS_20` email goes out with the
   correct amount and due date; re-running the job the same day sends nothing more.
7. An overdue unpaid milestone keeps the customer in the reminder set (banner stays red,
   `OVERDUE` emails continue on the configured cadence).
8. A payment that settles but fails a guard rail is **kept**, flagged
   `needs_manual_review`, and returns `installment_status: "rejected"` (no 4xx).
