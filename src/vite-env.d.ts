/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_RAZORPAY_KEY_ID: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface RazorpayHandlerResponse {
	razorpay_payment_id: string;
	razorpay_order_id: string;
	razorpay_signature: string;
}

interface RazorpayOptions {
	key: string;
	amount: number;
	currency: string;
	name: string;
	description: string;
	order_id: string;
	handler: (response: RazorpayHandlerResponse) => void | Promise<void>;
	prefill?: {
		method?: string;
		email?: string;
		name?: string;
	};
	theme?: {
		color?: string;
	};
	modal?: {
		ondismiss?: () => void;
	};
}

interface RazorpayInstance {
	open(): void;
	on(event: "payment.failed", handler: () => void): void;
}

interface Window {
	Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
}
