# BoulderSoc maths

A small static site that answers one question: **is the $10 UNSW BoulderSoc membership worth it for how often you climb?**

For each Sydney gym in the soc's discount list, it compares the soc member price with the gym's own options (casual entry, 10-visit passes, prepaid and recurring memberships). It shows the range of visits where the membership is the cheapest option. Every price links to its source and shows the date it was checked.

Unofficial. It is not affiliated with UNSW BoulderSoc or any gym.

## How the maths works

All costs are worked out over a timeframe (default 1 year), assuming your visits are spread evenly across it.

| Option | Cost over the timeframe |
|---|---|
| BoulderSoc member | membership fee × memberships needed + soc price × visits − store/food savings |
| Casual entry | price × visits |
| Multi-visit pass, no expiry | price × visits ÷ pass size (leftover visits keep their value; this can be turned off in Settings) |
| Multi-visit pass with expiry | enough passes for each expiry window you climb in |
| Prepaid membership | price × ⌈timeframe ÷ length⌉ |
| Recurring membership | upfront + price × ⌈max(timeframe, minimum term) ÷ billing period⌉ |

The "best for X–Y visits" range comes from checking every visit count from 1 up to one visit a day.

Intro offers (free first week, 2-week trials) are listed in each gym's notes but **not** counted, on the assumption that you've already used them. Shoe hire isn't included.

## Files

```
index.html       calculator and gym comparison
settings.html    edit any value (saved in localStorage on that device)
css/style.css
js/data.js       default prices: the one file to edit when prices change
js/calc.js       cost maths
js/store.js      localStorage load/save
js/main.js       calculator page
js/settings.js   settings page
js/format.js     shared formatting helpers
```

## Updating prices

Edit `js/data.js`:
1. Change the prices and set `CHECKED` to today's date.
2. Set `verified: false` and add a `note` on any price you couldn't confirm.

Changing `CHECKED` also tells visitors who have local edits that newer default prices are available.

### Prices not fully confirmed (as of 23 Oct 2026)

- **SICG:** casual $21.50 and 10-pass $190 (concession) come from a search snippet, because the official page loads prices with JavaScript.
- **Beta One:** 10-pass and 3/6/12-month prices come from search results. The weekly membership price isn't listed.
- **1UP:** 1/3/12-month prepaid prices come from search results.
- **Elevate:** casual concession $21. It's unclear whether uni students count as concession.
- **Sandbox:** student prices are read from an unlabelled second price list.
- **TopOut:** memberships aren't labelled adult or student.

## Running locally

ES modules need a local server; opening the HTML file directly won't work.

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Publishing on GitHub Pages

In the repo on GitHub, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`. The `.nojekyll` file makes Pages serve the files as they are.
