import { ONLINE_PAYMENTS_ENABLED } from './paymentsApi';

/** Loads Razorpay Checkout.js on demand and opens the payment modal. */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  amountPaise: number;
  currency: string;
  orderId: string;
  name: string;
  description?: string;
  prefillEmail?: string;
  prefillName?: string;
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpayResult> {
  // Keep this guard in the checkout loader too, so no Razorpay script or modal
  // can be started if a caller misses the UI/API feature gate.
  if (!ONLINE_PAYMENTS_ENABLED) {
    throw new Error('Razorpay checkout is disabled until the payment server is configured.');
  }
  await loadCheckoutScript();
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
      return;
    }
    const checkout = new window.Razorpay({
      key: options.keyId,
      amount: options.amountPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      prefill: { email: options.prefillEmail, name: options.prefillName },
      theme: { color: '#061f2d' },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    });
    checkout.open();
  });
}
