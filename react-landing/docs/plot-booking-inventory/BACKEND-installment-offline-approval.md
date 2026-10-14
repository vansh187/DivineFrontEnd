# Backend contract: customer instalment payment approval

The customer profile frontend submits cash and NEFT/RTGS instalments for review. A customer submission is not a receipt: it must not increase the booking's received amount or mark the milestone paid until an admin approves it.

## Customer submission

`POST /payments/offline-submissions` (customer bearer token):

```json
{
  "amount": 266146,
  "purpose": "installment",
  "installment_no": 2,
  "due_date": "2025-02-24",
  "method": "rtgs_neft",
  "utr_number": "UTR123456789"
}
```

`method` is `cash` or `rtgs_neft`. Require a non-empty UTR for `rtgs_neft`; do not accept a UTR for cash. Validate ownership, booking, amount, milestone order, due window, and duplicate pending submissions. Return `201` with:

```json
{
  "id": "offline-payment-submission-id",
  "amount": 266146,
  "method": "rtgs_neft",
  "status": "pending_review",
  "installment_no": 2,
  "utr_number": "UTR123456789",
  "created_date": "2025-02-20T09:12:44Z"
}
```

Keep the schedule row unpaid and its `amount_received` unchanged. Return `status: "pending_review"` for that row in `GET /customer/profile` so the customer sees the pending state after reloading and cannot submit a duplicate.

## Admin review

Expose pending submissions in the admin payments queue with customer, booking/plot, milestone, amount, method, UTR (when supplied), submission time, and status. Admins need actions to approve or reject a submission, with an audit record containing reviewer, timestamp, and decision; rejection should also store an optional reason.

On approval, in one transaction, mark the submission approved, create/settle the payment record, mark the corresponding schedule milestone `paid`, store its paid date and payment id, and update booking `amount_received` / outstanding totals. On rejection, mark only the submission rejected and keep the milestone unpaid and payable. The next profile fetch must reflect the updated schedule.

Suggested admin endpoints, if no existing review routes cover this flow:

- `GET /admin/payments/offline-submissions?status=pending_review`
- `POST /admin/payments/offline-submissions/{id}/approve`
- `POST /admin/payments/offline-submissions/{id}/reject` with `{ "reason": "..." }`

All admin routes must require an admin role. Approval/rejection must be idempotent and must reject already-decided submissions.
