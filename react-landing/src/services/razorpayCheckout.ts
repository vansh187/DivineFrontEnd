/** Loads Razorpay's Checkout.js on demand and opens the payment modal. No official TS
 * types package is used for the third-party window.Razorpay global - only the exact
 * surface this app calls is typed here. */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open: () => void;
}

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

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
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
  await loadCheckoutScript();
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Could not load the payment provider. Check your connection and try again.'));
      return;
    }
    const rzp = new window.Razorpay({
      key: options.keyId,
      amount: options.amountPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      prefill: { email: options.prefillEmail, name: options.prefillName },
      theme: { color: '#1e4d3b' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    });
    rzp.open();
  });
}
