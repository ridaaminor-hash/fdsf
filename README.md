# Masterclass IA Clinique — Production Site

Production-ready site with:
- Rewritten hero + prominent CTA and accreditation badge
- Pre-checkout modal (Podia preview + invoice info)
- Server-side lead capture at `/api/leads` (replaces formsubmit.co)
- GA4 events and cross-domain linker for Podia
- Server-driven offer expiry timestamp and countdown
- LinkedIn Conversions API (server-side skeleton)
- Performance hints (preload hero, WebP), accessibility focus management

## Quick start

1) Copy `.env.example` to `.env` and fill values.

2) Install and run:

```bash
npm install
npm start
```

Visit http://localhost:3000

## Configure

- GA4: replace `G-XXXXXXX` in `public/index.html` head and set `GA4_MEASUREMENT_ID` + `GA4_API_SECRET` in `.env`.
- Podia checkout URL: edit `PODIA_CHECKOUT_URL` in `public/index.html`.
- LinkedIn CAPI: set `LINKEDIN_PARTNER_ID` and `LINKEDIN_ACCESS_TOKEN` in `.env`.
- Offer expiry: set `OFFER_EXPIRE_AT` ISO timestamp in `.env` or server uses 48h from boot.

## Endpoints

- POST `/api/leads` — { name, email, org, role, consent, utm, referrer, page } -> { lead_id }
- GET `/api/config` — { offerExpireAt }
- POST `/api/track-outbound` — accepts beacon JSON; 204
- POST `/webhooks/podia` — webhook skeleton for purchase -> GA4 MP + LinkedIn skeleton

## Notes

- Replace placeholder images in `public/index.html` with your optimized WebP assets.
- Add further rate limiting, storage, and security as needed for production.
