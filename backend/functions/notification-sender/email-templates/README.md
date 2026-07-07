# Email templates

One template per notification type (SES, HTML + text):

- `booking-confirmation` — deposit paid, order confirmed
- `quote-ready` — quote with 48h expiry note
- `completion-balance` — garlands ready + Stripe balance payment link + PDF invoice (see architecture-plan.md §9 flow 4)
- `event-reminder` — 2 weeks before event
- `thank-you-review` — post-completion review request

TODO: implement as `.ts` template functions returning `{subject, html, text}`.
