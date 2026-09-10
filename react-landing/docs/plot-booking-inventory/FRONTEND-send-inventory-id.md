# Frontend spec — mark a plot `booked` the moment its booking payment is confirmed

**Status: IMPLEMENTED** on `agent/broker-commission-api` — see "As built" at the bottom.

**Owner:** Frontend team (react-landing)
**Related backend spec:** `BACKEND-inventory-mark-booked.md`

**Defect:** After a plot booking is completed and the 10% booking amount is paid, the
inventory row is never updated. The plot stays `status = "available"` and keeps showing in
`GET /inventory/search` to other customers / partners. It must drop out of the available
pool the instant the booking payment is confirmed.

This spec traces the **actual code path** for both roles and pins the exact line where the
"mark booked" call belongs.

---

## PART A — CUSTOMER FLOW

### A1. Full path trace (plot object → payment)

```
BookPlotPage.handleBook(unit)                         src/pages/BookPlotPage.tsx:67
  └─ navigate('/customer', { state: { unit } })
        (identical entry from CustomerPlotsPage.handleBook)   src/pages/CustomerPlotsPage.tsx:9

CustomerPage  useEffect                               src/pages/CustomerPage.tsx:152
  ├─ savePendingUnit(email, unit)   → localStorage['dvi_pending_unit_<email>']
  ├─ setPendingUnit(unit)
  └─ navigate(pathname, { replace: true, state: {} })   // nav state wiped here

CustomerPage renders <CustomerDocuments pendingUnit={pendingUnit} />   :185

CustomerDocuments  "Continue to application" button    src/components/CustomerDocuments.tsx:429
  └─ navigate('/customer/application', { state: { unit: pendingUnit } })

CustomerApplicationPage  arrival useEffect            src/pages/CustomerApplicationPage.tsx:348
  ├─ reads location.state.unit
  ├─ applyFormUpdates({ unitNo, plotAreaSqYd, plotAreaSqMtr, unitType, projectId })
  │        WARNING: unit.id is READ here but NOT stored anywhere
  └─ navigate(pathname, { replace: true, state: {} })   // nav state wiped again

... customer completes 13 wizard pages (only docs.bookingApplication.formData persists) ...

CustomerApplicationPage  final page:
  handlePayNow()                                      src/pages/CustomerApplicationPage.tsx:473
    - createPaymentOrder(session.token, amount)              -> POST /payments/create-order
    - openRazorpayCheckout({...})
    - verifyPayment(session.token, {order_id, payment_id, signature})  -> POST /payments/verify
    - if (record.verified) persist({ ...docs, payment: { status: 'paid', paymentId, ... } })
                                          <-- * PAYMENT CONFIRMED (online)

  handlePayByCash()                                   src/pages/CustomerApplicationPage.tsx:523
    - recordCashPayment(session.token, amount, note)         -> POST /payments/cash
    - persist({ ...docs, payment: { status: 'paid', paymentId, ... } })
                                          <-- * PAYMENT CONFIRMED (cash)

... later, optional ...
  handleGenerate()                                    src/pages/CustomerApplicationPage.tsx:579
    - uploadGeneratedApplicationPdf(token, { file, projectId, paymentId, ... })
                                                       -> POST /documents/project-booking-application
```

**Two problems:**
1. `unit.id` is never persisted — by the time the customer pays (could be minutes later,
   across reloads), the only surviving state is `docs.bookingApplication.formData`, which
   holds `unitNo` (free text like `"A-12"`) but not the inventory row id.
   `localStorage['dvi_pending_unit_<email>']` still has the full unit, but it is not wired
   into the payment calls.
2. No call in the flow tells the backend "this inventory row is now booked".

### A2. Fix — step by step

#### Step 1 - persist the inventory id - `src/services/documentStore.ts`

Add to `BookingApplicationStatus` (line ~208):

```ts
export interface BookingApplicationStatus {
  formData: BookingApplicationFormData;
  inventoryId: string | null;         // NEW - inventory row id of the plot being booked
  inventoryUnitNumber: string | null; // NEW - for conflict messages ("Plot A-12 ...")
  generatedAt: string | null;
  // ...unchanged...
}
```

Default both to `null` in `emptyBookingApplicationStatus()` (or wherever the initial
`bookingApplication` object is built).

#### Step 2 - capture it on arrival - `src/pages/CustomerApplicationPage.tsx:348`

Inside the arrival `useEffect`, after the `applyFormUpdates({...})` call:

```ts
// Keep the inventory row id so the booking payment can lock the plot even
// after reloads (nav state and formData do not carry it).
const unitFromState = (location.state as { unit?: InventoryUnit } | null)?.unit;
const unit = unitFromState ?? loadPendingUnit(email);   // loadPendingUnit from services/pendingUnit
if (unit?.id && !docs.bookingApplication.inventoryId) {
  persist({
    ...docs,
    bookingApplication: {
      ...docs.bookingApplication,
      inventoryId: unit.id,
      inventoryUnitNumber: unit.unit_number ?? null,
    },
  });
}
```

#### Step 3 - send it on the payment - `src/services/paymentsApi.ts`

```ts
export function createPaymentOrder(
  token: string,
  amount: number,
  opts?: { purpose?: 'plot_booking' | 'other'; inventoryId?: string | null },
): Promise<PaymentOrder> {
  return authedRequest<PaymentOrder>('/payments/create-order', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      purpose: opts?.purpose ?? 'other',
      ...(opts?.inventoryId ? { inventory_id: opts.inventoryId } : {}),
    }),
  });
}

export function recordCashPayment(
  token: string,
  amount: number,
  note?: string,
  opts?: { purpose?: 'plot_booking' | 'other'; inventoryId?: string | null },
): Promise<PaymentRecord> {
  return authedRequest<PaymentRecord>('/payments/cash', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      note: note || undefined,
      purpose: opts?.purpose ?? 'other',
      ...(opts?.inventoryId ? { inventory_id: opts.inventoryId } : {}),
    }),
  });
}
```

Extend `PaymentRecord`:

```ts
export interface PaymentRecord {
  // ...existing...
  inventory_id?: string | null;
  inventory_status?: 'booked' | 'conflict' | null;      // NEW
  inventory_conflict_reason?: string | null;            // NEW
}
```

The backend flips `available -> booked` inside `POST /payments/verify` /
`POST /payments/cash` when the payment row has `purpose: "plot_booking"` + `inventory_id`
(see backend spec 2.2). **This is the "mark booked when payment confirmed" hook.**

#### Step 4 - call sites - `src/pages/CustomerApplicationPage.tsx`

`handlePayNow` (line 473):

```ts
const inventoryId = docs.bookingApplication.inventoryId;
const order = await createPaymentOrder(session.token, amount, {
  purpose: inventoryId ? 'plot_booking' : 'other',
  inventoryId,
});
// ...openRazorpayCheckout unchanged...
const record = await verifyPayment(session.token, { /* unchanged */ });

if (isShortPayment(record.amount)) { /* unchanged */ }

// NEW - the plot was gone by the time the money landed
if (record.inventory_status === 'conflict') {
  persist({ ...docs, payment: { /* still record it, status 'paid' */ } });
  setPaymentError(
    `Plot ${docs.bookingApplication.inventoryUnitNumber ?? ''} was just booked by someone else. ` +
    `Your payment is safe - our team will contact you about a refund or another plot.`,
  );
  return;
}
// ...existing persist({ payment: { status: 'paid', ... } }) ...
```

`handlePayByCash` (line 523): same shape -

```ts
const inventoryId = docs.bookingApplication.inventoryId;
const record = await recordCashPayment(session.token, amount,
  'Cash recorded from booking application final page.',
  { purpose: inventoryId ? 'plot_booking' : 'other', inventoryId });
if (record.inventory_status === 'conflict') { /* same warning as above */ return; }
```

#### Step 5 - safety net on packet upload - `src/services/documentsApi.ts`

```ts
export interface UploadGeneratedApplicationPdfInput {
  // ...existing...
  inventoryId?: string | null;     // NEW
}

// in uploadGeneratedApplicationPdf(), after formData.append('payment_id', ...):
if (input.inventoryId) formData.append('inventory_id', input.inventoryId);
```

Extend `GeneratedDocument`:

```ts
inventory_id?: string | null;
inventory_status?: 'booked' | 'conflict' | null;
```

New `400` detail -> message mappings in `messageForDocumentsError`:

```ts
if (detail === 'inventory_not_found') return 'That plot could not be found in inventory. Please contact support.';
if (detail === 'inventory_project_mismatch') return 'The selected plot does not belong to this project. Please re-pick the plot.';
if (detail === 'unit_not_available') return 'This plot was just booked by another customer. Please contact support.';
```

`handleGenerate` call site (line ~737): pass
`inventoryId: docs.bookingApplication.inventoryId`.

#### Step 6 - list auto-refresh - no code change required

`AvailablePlotsList` already fetches `searchInventory({ status: 'available' })` and
re-filters to `status === 'available'` (`src/components/AvailablePlotsList.tsx:78-81`).
Once the backend drops `booked` rows from search, the plot disappears on the next load.
Optional: bump a `refreshSignal` if the list is mounted when a booking completes.

---

## PART B — CHANNEL-PARTNER FLOW

### B1. Full path trace

```
BrokerPlotsPage                                       src/pages/BrokerPlotsPage.tsx:15
  <AvailablePlotsList actionLabel="Schedule Visit" onAction={setScheduleUnit} />

ScheduleVisitModal.handleSubmit()                     src/components/ScheduleVisitModal.tsx:42
  - reserveInventoryUnit(session.token, unit.id)      -> POST /inventory/{id}/reserve
         status: available -> reserved   (3-day exclusive hold, plot leaves search)
  - createVisit(...)                                  (best-effort visit log)
  - saveReservationVisitor(email, unit.id, {...})     (localStorage)
  - onReserved(reservedUnit) -> navigate('/broker/leads')

BrokerLeadsPage                                       src/pages/BrokerLeadsPage.tsx
  - listMyReservedUnits(token)                        -> GET /inventory/reserved/mine
  - handleMarkSold(unit)   :52
        - markInventoryUnitSold(token, unit.id)       -> POST /inventory/{id}/mark-sold
               status: reserved -> sold   (plot gone permanently)
  - handleRelease(unit)    :66
        - releaseInventoryUnit(token, unit.id)        -> POST /inventory/{id}/release
               status: reserved -> available
```

### B2. Gap

- `reserve` already hides the plot (good - a partner holding it means nobody else sees it).
- **But there is no booking-payment step.** `handleMarkSold` is a bare manual button - a
  partner can mark a plot sold with **no booking amount recorded**, and a plot they
  reserved but never collect payment on silently frees up after 3 days.
- The requirement - *"when payment is confirmed, mark the plot booked"* - applies here
  too: the partner must record the customer's 10% booking amount, and only a **confirmed
  payment** should move the plot to `booked`.

### B3. Fix — add a booking-payment action to the partner's reserved lead

#### Step 1 - service calls - `src/services/paymentsApi.ts`

Reuse `createPaymentOrder` / `recordCashPayment` from Part A (they already take
`purpose` + `inventoryId`). No new function needed - partners authenticate the same way
(`session.token`).

#### Step 2 - `BrokerLeadsPage` - replace bare "Mark sold" with "Record booking payment"

On each reserved unit card, add a **"Record booking payment"** button that opens a small
modal (mirror of the customer's pay panel):

```ts
// BrokerLeadsPage - new handler
const handleRecordBookingPayment = async (unit: InventoryUnit, amount: number, mode: 'cash' | 'online') => {
  if (!session) return;
  setActioningId(unit.id);
  try {
    let record;
    if (mode === 'cash') {
      record = await recordCashPayment(session.token, amount,
        `Booking amount for ${unit.project_name} Plot ${unit.unit_number ?? ''} (channel partner).`,
        { purpose: 'plot_booking', inventoryId: unit.id });
    } else {
      const order = await createPaymentOrder(session.token, amount,
        { purpose: 'plot_booking', inventoryId: unit.id });
      const res = await openRazorpayCheckout({ /* order fields */ });
      record = await verifyPayment(session.token, {
        razorpay_order_id: res.razorpay_order_id,
        razorpay_payment_id: res.razorpay_payment_id,
        razorpay_signature: res.razorpay_signature,
      });
    }
    if (record.inventory_status === 'conflict') {
      setError(`Plot ${unit.unit_number ?? ''} is no longer available.`);
      return;
    }
    // backend moved reserved -> booked; drop it from the "reserved leads" list
    setUnits((current) => current.filter((item) => item.id !== unit.id));
  } catch (err) {
    setError(err instanceof ApiError ? err.message : 'Could not record the booking payment.');
  } finally {
    setActioningId(null);
  }
};
```

- The amount is 10% of the agreed total plot amount - add a numeric input in the modal
  (partner types the total, UI derives 10%), same rule as `bookingAmountFor()` in
  `CustomerApplicationPage.tsx:28`.
- Keep **"Mark sold"** as a separate, later action (full sale / registration) - but the
  backend should reject `mark-sold` unless a settled `plot_booking` payment exists for
  that inventory id (backend spec 3, endpoint note).
- Keep **"Release"** unchanged.

#### Step 3 - `ScheduleVisitModal` - no change

Reserve stays as the soft hold. `reserved -> booked` happens only when the partner records
the confirmed booking payment in `BrokerLeadsPage`.

---

## PART C — endpoints the frontend calls (request type + new fields)

| Role | Method | Path | Body type | Fields FE adds | Response fields FE reads |
|------|--------|------|-----------|----------------|--------------------------|
| customer + partner | `POST` | `/payments/create-order` | JSON | **`purpose`**, **`inventory_id`** (+ existing `amount`) | unchanged |
| customer + partner | `POST` | `/payments/verify` | JSON | unchanged (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`) | **`inventory_status`**, **`inventory_conflict_reason`** |
| customer + partner | `POST` | `/payments/cash` | JSON | **`purpose`**, **`inventory_id`** (+ existing `amount`, `note`) | **`inventory_status`** |
| customer | `POST` | `/documents/project-booking-application` | multipart/form-data | **`inventory_id`** field | **`inventory_status`** |
| partner | `POST` | `/inventory/{id}/reserve` | empty body | - (unchanged) | `status`, `reserved_until` |
| partner | `POST` | `/inventory/{id}/mark-sold` | empty body | - (unchanged; backend now requires a settled booking payment) | `status` |
| partner | `POST` | `/inventory/{id}/release` | empty body | - (unchanged) | `status` |

**Inventory status transition is owned by the payment call.**
`POST /payments/verify` and `POST /payments/cash`, when the payment row has
`purpose = "plot_booking"` + `inventory_id`, move that inventory row
`available | held | reserved(by same actor) -> booked` in the same transaction that
settles the payment. The frontend never sets inventory status directly - it only supplies
`inventory_id` + `purpose` and reads back `inventory_status`.

### Sample - create order (both roles)

```http
POST /payments/create-order
Authorization: Bearer <token>
Content-Type: application/json

{ "amount": 500000, "purpose": "plot_booking",
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b" }
```

```jsonc
// 200
{ "payment_id": "pay_9Q...", "razorpay_order_id": "order_NQ...",
  "razorpay_key_id": "rzp_test_xxx", "amount": 500000,
  "amount_paise": 50000000, "currency": "INR", "status": "created" }
```

### Sample - verify, happy path (plot booked)

```http
POST /payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{ "razorpay_order_id": "order_NQ...", "razorpay_payment_id": "rzp_pay_...",
  "razorpay_signature": "9ef1b...c2" }
```

```jsonc
// 200
{
  "id": "pay_9Q...", "owner_id": "usr_123", "owner_role": "customer",
  "amount": 500000, "currency": "INR", "status": "paid",
  "method": "razorpay", "verified": true,
  "razorpay_order_id": "order_NQ...", "razorpay_payment_id": "rzp_pay_...",
  "created_date": "2026-09-08T10:34:12Z",
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "inventory_status": "booked"
}
```

### Sample - verify, race lost (payment kept, plot not booked)

```jsonc
// 200
{
  "id": "pay_9Q...", "status": "paid", "verified": true,
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "inventory_status": "conflict",
  "inventory_conflict_reason": "unit_not_available"
}
```

Frontend shows: *"Plot A-12 was just booked by someone else. Your payment is safe - our
team will contact you about a refund or another plot."*

### Sample - cash (partner recording a walk-in booking)

```http
POST /payments/cash
Authorization: Bearer <partner token>
Content-Type: application/json

{ "amount": 500000,
  "note": "Booking amount for OPS Divine Greens Plot A-12 (channel partner).",
  "purpose": "plot_booking",
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b" }
```

```jsonc
// 200
{ "id": "pay_cash_71...", "amount": 500000, "currency": "INR",
  "status": "paid", "method": "cash", "verified": true,
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "inventory_status": "booked" }
```

### Sample - booking-application packet upload (customer)

```http
POST /documents/project-booking-application
Authorization: Bearer <customer token>
Content-Type: multipart/form-data; boundary=----x

------x
Content-Disposition: form-data; name="file"; filename="ops-divine-greens-booking-application.pdf"
Content-Type: application/pdf

<binary>
------x
Content-Disposition: form-data; name="document_type"

project_booking_application
------x
Content-Disposition: form-data; name="project_id"

ops-divine-greens
------x
Content-Disposition: form-data; name="payment_id"

pay_9Q...
------x
Content-Disposition: form-data; name="inventory_id"

b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b
------x
Content-Disposition: form-data; name="form_data"

{"applicantName":"...","total_amount":5000000}
------x--
```

```jsonc
// 200
{
  "id": "doc_7K...", "owner_id": "usr_123", "owner_role": "customer",
  "document_type": "project_booking_application", "status": "generated",
  "created_date": "2026-09-08T10:36:40Z",
  "signed_url": "https://storage.../doc_7K.pdf?sig=...",
  "signed_url_expires_in": 3600,
  "payment_plan": { "milestones": [ /* ... */ ] },
  "inventory_id": "b0e1f2a3-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
  "inventory_status": "booked"
}
```

---

## PART D — files this frontend change touches

| File | Change |
|------|--------|
| `src/services/documentStore.ts` | `+ inventoryId`, `+ inventoryUnitNumber` on `BookingApplicationStatus` + defaults |
| `src/pages/CustomerApplicationPage.tsx` | capture `unit.id` on arrival; pass `inventoryId`/`purpose` in `handlePayNow`, `handlePayByCash`, `handleGenerate`; handle `inventory_status === 'conflict'` |
| `src/services/paymentsApi.ts` | `createPaymentOrder` / `recordCashPayment` take `purpose` + `inventoryId`; `PaymentRecord` gains `inventory_*` fields |
| `src/services/documentsApi.ts` | `uploadGeneratedApplicationPdf` sends `inventory_id`; `GeneratedDocument` gains `inventory_*`; 3 new error messages |
| `src/pages/BrokerLeadsPage.tsx` | new "Record booking payment" action (cash/online) on reserved leads -> moves `reserved -> booked`; gate "Mark sold" behind a settled booking payment |
| `src/services/inventoryApi.ts` | *(Phase 2 only)* `holdInventoryUnit()` |
| `src/components/AvailablePlotsList.tsx` | no change (already filters `status === 'available'`) |

## PART E — QA checklist

- [ ] Customer books + pays online -> plot gone from `/book-plot` and `/customer/plots` on reload.
- [ ] Customer books + pays cash -> same.
- [ ] Reload mid-wizard -> `inventoryId` still in `documentStore`, still sent on payment.
- [ ] Same plot in two customer tabs, both pay -> 2nd tab shows conflict message, payment still recorded, no fake success.
- [ ] Legacy in-progress draft with no `inventoryId` -> payment works, `purpose: "other"`, no crash.
- [ ] Partner reserves plot -> plot leaves search immediately (already works).
- [ ] Partner records booking payment on a reserved lead -> lead moves out of "My leads", plot stays out of search as `booked`.
- [ ] Partner "Mark sold" with no booking payment recorded -> backend rejects with a clear message.
- [ ] Partner "Release" on a reserved (not yet booked) plot -> returns to `available`.
- [ ] `npm run build` clean.

---

## AS BUILT (implemented)

Matches the backend team's finalized contract. Delivered on `agent/broker-commission-api`.

### Files changed

| File | What landed |
|------|-------------|
| `src/services/paymentsApi.ts` | `createPaymentOrder(token, amount, { purpose, inventoryId })` and `recordCashPayment(token, amount, note, { purpose, inventoryId })` — both send `purpose` (`"plot_booking"` \| `"other"`, default `"other"`) and `inventory_id` (only when set). `PaymentRecord` gains `inventory_id`, `inventory_status` (`"booked"` \| `"conflict"` \| `null`), `inventory_conflict_reason` (`"unit_not_available"` \| `"inventory_update_failed"` \| `null`). New `400 invalid_purpose` message. |
| `src/services/documentStore.ts` | `BookingApplicationStatus` += `inventoryId`, `inventoryUnitNumber` (defaults `null`, carried through `emptyBookingApplicationStatus()` and the `loadCustomerDocs` merge, kept by `slimDocsForStorage`). `PaymentStatus` += `inventoryStatus`, `inventoryConflictReason`. |
| `src/services/documentsApi.ts` | `UploadGeneratedApplicationPdfInput` += `inventoryId`; sent as the `inventory_id` form field. `GeneratedDocument` += `inventory_id`, `inventory_status`. No new error codes (contract: the upload never fails on the inventory step). |
| `src/pages/CustomerApplicationPage.tsx` | Arrival `useEffect` binds `unit.id` → `bookingApplication.inventoryId` **once**, only on a fresh application (no `projectId`, no existing `inventoryId`) so a stale unit can't attach to a booking already underway. `handlePayNow` / `handlePayByCash` pass `{ purpose, inventoryId }` and persist `inventoryStatus` / `inventoryConflictReason` from the response. `handleGenerate` sends `inventoryId` and syncs the banner from `backendDoc.inventory_status`. |
| `src/components/RecordBookingPaymentModal.tsx` | **New.** Partner enters the agreed Total Plot Amount → 10% booking instalment; "Pay online (Razorpay)" or "Record cash payment", both with `purpose: "plot_booking"` + `inventory_id: unit.id`. On `inventory_status: "booked"` → `onBooked(unit)`; on `"conflict"` → in-modal amber notice, lead stays. |
| `src/pages/BrokerLeadsPage.tsx` | "Record booking payment" button on each reserved lead opens the modal; `onBooked` drops the lead from "My leads". "Mark sold" / "Release" unchanged (both now secondary styling). |

### Conflict handling (customer)

Keyed off `record.inventory_status === 'conflict'` — a persistent amber banner under the
"Paid" line (`docs.payment.inventoryStatus === 'conflict'`), never a red payment error.
Copy: *"Your payment went through. Plot &lt;n&gt; was just booked by another customer… our
team will call you shortly to re-assign a plot or arrange a refund — you don't need to pay
again."* PDF generation stays unlocked (customer paid; backend flagged for manual review).

### Verified

`npm run build` (`tsc -b && vite build`) ✅  ·  `npm run lint` (oxlint) ✅ — no new warnings.
