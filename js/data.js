// Default values. Everything here can be overridden locally on the Settings page.
// Prices checked on each gym's own website on CHECKED. Soc prices are from the
// BoulderSoc Instagram post of 4 Aug 2026.

const CHECKED = "2026-10-23";

const week = (n) => ({ n, unit: "week" });
const month = (n) => ({ n, unit: "month" });
const year = (n) => ({ n, unit: "year" });

// Plan kinds:
//   casual    - pay per visit
//   pack      - `visits` entries for `price`; optional `expiry` period (null = none)
//   prepaid   - unlimited for `length`, paid upfront
//   recurring - unlimited, `price` billed every `billing`, with optional `minTerm` and `upfront`
// audience: "student" | "concession" | "adult" | "all" (whose price this is)
const casual = (price, audience, extra = {}) => ({ kind: "casual", label: "Casual entry", price, audience, ...extra });
const pack = (price, visits, audience, extra = {}) => ({ kind: "pack", label: `${visits}-visit pass`, price, visits, expiry: null, audience, ...extra });
const prepaid = (price, length, audience, extra = {}) => ({ kind: "prepaid", label: `${length.n} ${length.unit}${length.n > 1 ? "s" : ""} prepaid`, price, length, audience, ...extra });
const recurring = (price, billing, audience, extra = {}) => ({ kind: "recurring", label: `${billing.unit === "week" ? "Weekly" : "Monthly"} membership`, price, billing, minTerm: null, upfront: 0, audience, ...extra });

const withIds = (gymId, plans) => plans.map((p, i) => ({ id: `${gymId}-${i}`, verified: true, checked: CHECKED, ...p }));

export const DEFAULT_DATA = {
  updated: CHECKED,
  membership: { fee: 10, length: year(1) },
  soc: {
    source: "https://www.instagram.com/unswbouldersoc/",
    posted: "2026-08-04",
  },
  settings: {
    timeframe: year(1),
    keepPackLeftovers: true, // a pass with no expiry: unused visits keep their value
  },
  gyms: [
    {
      id: "9degrees", name: "9 Degrees", requiresUniId: true, socPrice: 18, socNote: "",
      source: "https://www.9degrees.com.au/info#pricing",
      notes: [
        "First visit: $26 ($24 student) gets a full week of unlimited climbing.",
        "2-week trial $49 (no student discount) for people who haven't had a pass or membership.",
        "Shoe hire $7, free on your first visit.",
      ],
      plans: withIds("9degrees", [
        casual(24, "student"),
        pack(216, 10, "student"),
        recurring(146, month(1), "student", { label: "Rolling membership", minTerm: month(1) }),
        prepaid(423, month(3), "student"),
        prepaid(787, month(6), "student"),
        prepaid(1410, month(12), "student"),
      ]),
    },
    {
      id: "nomad", name: "Nomad", requiresUniId: true, socPrice: 16, socNote: "",
      source: "https://www.nomadbouldering.com.au/pricing/membership-and-casual-entry",
      notes: [
        "2-week intro trial $52 (18+).",
        "Early-bird 10-pack (before 2pm) $208, adult.",
        "Gladesville-only membership $30/week.",
        "Student, trimester and semester memberships exist but are on a separate page that wasn't checked. Memberships below are adult prices.",
        "Shoe hire $7.",
      ],
      plans: withIds("nomad", [
        casual(24, "student"),
        pack(216, 10, "student"),
        prepaid(140, month(1), "adult"),
        prepaid(400, month(3), "adult"),
        prepaid(790, month(6), "adult"),
        prepaid(1375, month(12), "adult"),
        recurring(36, week(1), "adult", { label: "Flashed (4-week contract)", minTerm: week(4) }),
        recurring(32, week(1), "adult", { label: "Onsight (6-month contract)", minTerm: month(6) }),
        recurring(30, week(1), "adult", { label: "Redpoint (12-month contract)", minTerm: month(12) }),
      ]),
    },
    {
      id: "blochaus", name: "Blochaus", requiresUniId: false, socPrice: 17, socNote: "",
      source: "https://syd.blochaus.com.au/pricing",
      notes: [
        "2-week membership with free shoe hire $49, for first-timers, bought in person.",
        "LCT mini membership $29/week; mates membership $31/person/week.",
        "Memberships cover Marrickville, Leichhardt, Canberra and Melbourne.",
        "Shoe hire $7. Casual entry is EFTPOS only.",
      ],
      plans: withIds("blochaus", [
        casual(24, "concession"),
        pack(216, 10, "concession"),
        prepaid(145, month(1), "all"),
        prepaid(420, month(3), "all"),
        prepaid(835, month(6), "all"),
        prepaid(1510, month(12), "all"),
        recurring(38, week(1), "all", { label: "All-haus membership" }),
      ]),
    },
    {
      id: "sicg", name: "Sydney Indoor Climbing Gym (St Peters)", requiresUniId: true, socPrice: 14.5,
      socNote: "Soc price only on Mon, Wed and Fri.",
      source: "https://indoorclimbing.com.au/stpeters/price-calculator/",
      notes: [
        "One-off registration fee on your first visit: $6.",
        "Membership prices include admin fees and the first week. Cancelling early costs $100.",
        "Concession covers full-time students.",
      ],
      plans: withIds("sicg", [
        casual(21.5, "concession", { source: "https://indoorclimbing.com.au/stpeters/our-prices/", verified: false, note: "Read from a search snippet of the official page; the page itself loads prices with JavaScript." }),
        pack(190, 10, "concession", { source: "https://indoorclimbing.com.au/stpeters/our-prices/", verified: false, note: "Read from a search snippet of the official page." }),
        prepaid(142, month(1), "concession"),
        prepaid(381, month(3), "concession"),
        prepaid(682, month(6), "concession"),
        prepaid(1192, month(12), "concession"),
        recurring(25, week(1), "concession", { label: "12-month instalments", minTerm: month(12), upfront: 25 }),
      ]),
    },
    {
      id: "betaone", name: "Beta One", requiresUniId: false, socPrice: 16,
      socNote: "Soc price is $16 on Mondays and $18 on Thursdays.",
      source: "https://betaone.com.au/pages/pricing",
      notes: [
        "2-week trial $49.",
        "A weekly membership exists (activated at the front desk) but its price isn't listed.",
        "Shoe hire $7, not included with memberships or the 10-pass.",
      ],
      plans: withIds("betaone", [
        casual(24, "all", { note: "The site lists a student day pass at the same $24; another page shows $22." }),
        pack(225, 10, "all", { source: "https://betaone.com.au/products/10-day-pass", verified: false, note: "Price from a search result for the product page." }),
        prepaid(385, month(3), "all", { verified: false, note: "Price from a search result; not shown on the pricing page." }),
        prepaid(720, month(6), "all", { verified: false, note: "Price from a search result; not shown on the pricing page." }),
        prepaid(1300, month(12), "all", { verified: false, note: "Price from a search result; not shown on the pricing page." }),
      ]),
    },
    {
      id: "1up", name: "1UP", requiresUniId: false, socPrice: 17, socNote: "",
      source: "https://www.oneupbouldering.com.au/pricing",
      notes: [
        "No 6-month or student membership listed.",
        "Shoe hire $7.",
      ],
      plans: withIds("1up", [
        casual(23, "concession"),
        pack(202, 10, "student"),
        recurring(36, week(1), "adult", { label: "Week to week" }),
        prepaid(150, month(1), "adult", { verified: false, note: "Price from a search result; the page loads prices with JavaScript." }),
        prepaid(430, month(3), "adult", { verified: false, note: "Price from a search result; the page loads prices with JavaScript." }),
        prepaid(1420, month(12), "adult", { verified: false, note: "Price from a search result; the page loads prices with JavaScript." }),
      ]),
    },
    {
      id: "elevate", name: "Elevate", requiresUniId: true, socPrice: 15, socNote: "",
      source: "https://www.elevateclimbing.com.au/visit",
      notes: [
        "Concession is listed for ages 12–17 and card holders. It's unclear whether uni students qualify.",
        "All memberships include one free week. Cancelling early costs $100.",
        "New-member intro: 2 weeks unlimited for $49, including harness or shoes.",
        "A first-visit registration fee applies (amount not listed).",
      ],
      plans: withIds("elevate", [
        casual(21, "concession", { verified: false, note: "Concession eligibility for uni students is unclear." }),
        pack(189, 10, "concession"),
        prepaid(136, month(1), "concession"),
        prepaid(390, month(3), "concession"),
        prepaid(685, month(6), "concession"),
        prepaid(1050, month(12), "concession"),
        recurring(26, week(1), "concession"),
      ]),
    },
    {
      id: "sandbox", name: "Sandbox", requiresUniId: false, socPrice: 15, socNote: "",
      source: "https://sandboxbouldering.com.au/pricing",
      notes: [
        "Student Wednesday: $14 entry from 5:30pm, cheaper than the soc price.",
        "First visit: $21 for 2 weeks of access (students save a further 10%).",
        "Student pricing is in person only.",
      ],
      plans: withIds("sandbox", [
        casual(19, "student", { verified: false, note: "The page has an unlabelled second price list; read as the student prices." }),
        pack(171, 10, "student", { verified: false, note: "Unlabelled second price list; read as student." }),
        prepaid(120, month(1), "student", { verified: false, note: "Unlabelled second price list; read as student." }),
        prepaid(330, month(3), "student", { verified: false, note: "Unlabelled second price list; read as student." }),
        prepaid(630, month(6), "student", { verified: false, note: "Unlabelled second price list; read as student." }),
        recurring(115, month(1), "student", { label: "Direct debit", minTerm: month(2), verified: false, note: "Unlabelled second price list; read as student." }),
      ]),
    },
    {
      id: "climbfit", name: "ClimbFit", requiresUniId: false, socPrice: 18,
      socNote: "ClimbFit's own uni-society rate is $18 including one gear hire, any day.",
      source: "https://www.climbfit.com.au/membership-2/",
      notes: [
        "Uni Student Monday: $18 including one gear hire for any uni/TAFE student (St Leonards, Kirrawee, Macquarie).",
        "No concession memberships listed; memberships below are adult prices.",
        "Weekly direct debit has a 3-month minimum and admin fees.",
      ],
      plans: withIds("climbfit", [
        casual(22, "concession", { source: "https://www.climbfit.com.au/pricing/" }),
        pack(200, 10, "concession"),
        prepaid(164, month(1), "adult"),
        prepaid(460, month(3), "adult"),
        prepaid(830, month(6), "adult"),
        prepaid(1450, month(12), "adult"),
        recurring(35, week(1), "adult", { label: "Weekly direct debit", minTerm: month(3) }),
      ]),
    },
    {
      id: "topout", name: "TopOut", requiresUniId: false, socPrice: 17, socNote: "",
      source: "https://topout.com.au/membership-and-pricing",
      notes: [
        "Leumeah.",
        "Shoe hire $5.",
      ],
      plans: withIds("topout", [
        casual(22, "student"),
        pack(198, 10, "student"),
        prepaid(395, month(3), "all", { verified: false, note: "Not labelled adult or student." }),
        prepaid(745, month(6), "all", { verified: false, note: "Not labelled adult or student." }),
        prepaid(1385, month(12), "all", { verified: false, note: "Not labelled adult or student." }),
        recurring(32, week(1), "all", { minTerm: week(12), verified: false, note: "Not labelled adult or student." }),
      ]),
    },
  ],
  stores: [
    { name: "Nobori", discountPct: 10, expectedSpend: 0 },
    { name: "Climbing Anchors", discountPct: 12.5, expectedSpend: 0 },
    { name: "Mountain Equipment", discountPct: 12.5, expectedSpend: 0 },
    { name: "Pinko Punko", discountPct: 15, expectedSpend: 0 },
    { name: "Sticky Bee Tape", discountPct: null, expectedSpend: 0 },
  ],
  food: [
    { name: "Tiger Pocha", discountPct: 10, expectedSpend: 0 },
  ],
};
