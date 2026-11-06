// Owner-approved launch offer. No checkout or charge can be initiated yet.
// account/subscribe.html shows the trial length but no price yet; tests/unit/subscribe-page.test.mjs checks both.
export const subscriptionOffer = Object.freeze({
  currency: "ILS",
  monthlyAmountMinor: 15000,
  trialDays: 3,
  checkoutAvailable: false,
});
