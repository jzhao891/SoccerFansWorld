# PAYMENT HLD Decisions

## 1. Legal & Regulatory Classification

- GenAI image/video modifications are classified as **digital goods** within mobile app ecosystems
- Direct credit card processing via custom web-views or embedded third-party SDKs (Stripe Elements, PayPal Mobile SDK) inside the native mobile interface is **prohibited** by Apple and Google — violators risk store bans
- All payment flows must route through approved platform rails

## 2. Payment Pipelines

### Pipeline A — Native In-App Purchases (IAP)

- **Implementation:** Apple StoreKit (iOS) + Google Play Billing (Android)
- **UX:** One-tap biometric checkout (Face ID / Fingerprint) for maximum conversion
- **Fee:** 15% platform cut under Apple/Google Small Business Programs (assuming baseline revenue thresholds are maintained)
- **Use case:** Primary purchase path inside the native apps

### Pipeline B — Mobile Web Billing Link

- **Implementation:** Open a secure in-app browser (`SFSafariViewController` on iOS, `CustomTabs` on Android) pointing to a mobile-optimized Stripe, PayPal, or Crypto checkout page hosted outside the native app
- **UX:** Compliant mechanism to bypass IAP fees on mobile; retains ~100% margin
- **Use case:** Web browser users and as an alternative path on mobile where IAP fees are undesirable

## 3. Token / Credit Pack Architecture

Rather than triggering a checkout for every individual generation event (high friction, microtransaction fatigue), the app uses a **token credit pack** model:

- Users purchase packs (e.g., $4.99 for 10 credits) via IAP or Web Billing Link
- Token balances are tracked in Firestore per user
- Async GenAI jobs deduct tokens **server-side** upon successful job validation — never client-side

## 4. Backend-Driven Payment Verification

The client is never trusted for payment validation:

1. Payment provider sends a signed async webhook to the backend (`App Store Server Notifications`, `Google Play Developer Notifications`, or `Stripe Webhooks`)
2. Backend verifies the webhook signature
3. Verified webhook updates the user's Firestore token balance
4. Token credit triggers async GenAI job worker queue to process image/video payloads
