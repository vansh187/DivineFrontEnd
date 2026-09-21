/** Loads Zoho Payments' widget.js on demand and opens the hosted checkout widget. No
 * official TS types package is used for the third-party window.ZPayments global - only
 * the exact surface this app calls is typed here. Mirrors the shape of the former
 * razorpayCheckout.ts so callers changed minimally when swapping gateways. */

const CHECKOUT_SRC = 'https://static.zohocdn.com/zpay/zpay-js/v1/zpayments.js';

interface ZohoPaymentMethodResult {
  payment_id: string;
  payments_session_id: string;
}

interface ZohoRequestPaymentOptions {
  amount: string;
  currency_code: string;
  payments_session_id: string;
  business?: string;
  description?: string;
}

interface ZohoPaymentsInstance {
  requestPaymentMethod: (options: ZohoRequestPaymentOptions) => Promise<ZohoPaymentMethodResult>;
  close: () => void;
}

interface ZohoPaymentsConfig {
  account_id: string;
  domain: 'IN' | 'US' | 'EU' | 'AU';
}

type ZPaymentsConstructor = new (config: ZohoPaymentsConfig) => ZohoPaymentsInstance;

declare global {
  interface Window {
    ZPayments?: ZPaymentsConstructor;
  }
}

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.ZPayments) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load the payment provider. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

export interface ZohoCheckoutOptions {
  accountId: string;
  /** Whole-rupee amount, e.g. 5000 for Rs. 5,000. Converted to the "0.00" string
   * Zoho's widget expects. */
  amount: number;
  currency: string;
  paymentsSessionId: string;
  name: string;
  description?: string;
}

export interface ZohoCheckoutResult {
  zoho_payment_id: string;
  zoho_payments_session_id: string;
}

/** Cancellation from the widget (user closed it, or backed out of a method) surfaces
 * as a rejected promise with no reliable `.message` from Zoho's SDK - normalize it to
 * the same "Payment cancelled." message callers already handle from the Razorpay days. */
export async function openZohoCheckout(options: ZohoCheckoutOptions): Promise<ZohoCheckoutResult> {
  await loadCheckoutScript();
  if (!window.ZPayments) {
    throw new Error('Could not load the payment provider. Check your connection and try again.');
  }
  if (!options.accountId || !options.paymentsSessionId) {
    // The widget's own rejection for this case has no useful `.code`/`.message`,
    // so catch it here instead where we can name which field the backend left empty.
    console.error('[zohoCheckout] missing required field(s) from the backend order:', {
      accountId: options.accountId,
      paymentsSessionId: options.paymentsSessionId,
    });
    throw new Error('Payment failed. Please try again.');
  }
  const instance = new window.ZPayments({ account_id: options.accountId, domain: 'IN' });
  try {
    const result = await instance.requestPaymentMethod({
      amount: options.amount.toFixed(2),
      currency_code: options.currency,
      payments_session_id: options.paymentsSessionId,
      business: options.name,
      description: options.description,
    });
    return { zoho_payment_id: result.payment_id, zoho_payments_session_id: result.payments_session_id };
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    // Surfaced to the console (not the UI) so a failed test payment can actually be
    // diagnosed - the SDK's real error shape isn't documented, so log the whole thing.
    console.error('[zohoCheckout] requestPaymentMethod failed:', err, { accountId: options.accountId });
    if (code === 'widget_closed' || code === 'payment_cancelled') {
      throw new Error('Payment cancelled.');
    }
    throw new Error('Payment failed. Please try again.');
  } finally {
    instance.close();
  }
}
