import { Link } from 'react-router-dom';
import { usePaymentSchedule } from '../hooks/usePaymentSchedule';
import { formatCurrencyINR, formatIndianDate } from '../utils/currency';

/**
 * Customer-home notice for the next construction-linked-plan instalment. Shows
 * from 20 days before the due date (see REMINDER_LEAD_DAYS) and turns red once
 * the instalment is overdue. Renders nothing when no payment is due soon.
 */
export function PaymentDueBanner() {
  const { reminder, loading } = usePaymentSchedule();
  if (loading || !reminder) return null;

  const { milestone, daysUntilDue, overdue } = reminder;
  const amount = milestone.amount != null ? formatCurrencyINR(milestone.amount) : 'your next instalment';
  const due = milestone.dueDate ? formatIndianDate(milestone.dueDate) : 'soon';

  return (
    <div
      role="status"
      className={`mt-6 rounded-lg border px-4 py-3 ${
        overdue ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <p className="text-sm font-semibold">
        {overdue
          ? `Instalment overdue — ${amount} was due on ${due}.`
          : daysUntilDue === 0
            ? `Instalment due today — ${amount} by ${due}.`
            : `Payment due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} — ${amount} by ${due}.`}
      </p>
      <p className="mt-1 text-xs">
        {milestone.label}.{' '}
        <Link to="/customer/profile#payments" className="font-semibold underline underline-offset-2">
          View schedule &amp; pay
        </Link>
      </p>
    </div>
  );
}
