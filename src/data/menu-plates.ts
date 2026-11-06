import type { ConveyorDish, DishTier } from '@/components/ui/sushi-conveyor-menu';

export interface PlanOption {
  id: string;
  name: string;
  dishName: string;
  sushiCorrelation: string;
  price: number;
  priceFormatted: string;
  tier: DishTier;
  tagline: string;
  features: string[];
  image: string;
}

export interface AddOnOption {
  id: string;
  code: string;
  name: string;
  dishName: string;
  sushiCorrelation: string;
  description: string;
  details: string[];
  price: string;
  priceNumber: number;
  tier: DishTier;
  image: string;
}

export const PLANS: PlanOption[] = [
  {
    id: 'plan-29999',
    name: '₹29,999 Plan',
    dishName: 'Salmon Nigiri',
    sushiCorrelation:
      'Fresh, clean, and the first plate everyone reaches for — built from scratch with zero filler to make people stop scrolling.',
    price: 29999,
    priceFormatted: '₹29,999',
    tier: 2,
    tagline: 'The face of your business, built to make people stop scrolling',
    features: [
      'Custom design drawn from scratch, no templates',
      'Up to 5 pages',
      'Flawless on every phone and screen',
      'Fast load speed so nobody bounces',
      '2 revision rounds until it feels right',
    ],
    image: '/assets/sushi/salmon-nigiri.webp',
  },
  {
    id: 'plan-64999',
    name: '₹64,999 Plan',
    dishName: 'California Roll (4-Piece)',
    sushiCorrelation:
      'Rolled with multiple layers inside-out (crab, avocado, cucumber & tobiko) — matching a multi-step lead flow, WhatsApp tap, listings, and gallery.',
    price: 64999,
    priceFormatted: '₹64,999',
    tier: 3,
    tagline: 'The machine that turns visitors into inquiries (+₹64,999 extra if stacked with ₹29,999)',
    features: [
      'Lead capture flow built around how your customers actually buy',
      'One tap WhatsApp contact',
      'Service or listing pages that sell',
      'Gallery and content setup done for you',
      'Clean structure so nothing is ever buried',
      '3 revision rounds',
    ],
    image: '/assets/sushi/california-roll.webp',
  },
  {
    id: 'plan-99999',
    name: '₹99,999 Plan',
    dishName: 'Bluefin Tuna on Black Lacquer',
    sushiCorrelation:
      'Prime cut served on a black lacquer plate — the serious revenue engine with integrated payment gateway, SSL hardening, and conversion tracking.',
    price: 99999,
    priceFormatted: '₹99,999',
    tier: 4,
    tagline: 'A business that collects money while you sleep',
    features: [
      'Payment gateway integrated and tested',
      'Security hardening and SSL',
      'Analytics and conversion tracking so you see exactly what makes money',
      'Speed and conversion pass before launch',
      '30 days of post-launch support',
      'Priority turnaround',
    ],
    image: '/assets/sushi/tuna-nigiri.webp',
  },
  {
    id: 'plan-184999',
    name: 'All Three Together',
    dishName: 'Chef’s Dragon Roll Special',
    sushiCorrelation:
      'The full house specialty roll draped in avocado and glaze — locking all three plans (₹29,999 + ₹64,999 + ₹99,999) together in one build.',
    price: 184999,
    priceFormatted: '₹1,84,999',
    tier: 5,
    tagline: 'Lock all three plans together in one go',
    features: [
      'All features from ₹29,999 + ₹64,999 + ₹99,999 included',
      'Custom design, lead capture, WhatsApp, and full payment gateway',
      'Priority turnaround and 30 days post-launch support',
    ],
    image: '/assets/sushi/dragon-roll.webp',
  },
];

export const ADD_ON_PRICE = 9999;

export const CORE_ADDONS: AddOnOption[] = [
  {
    id: 'addon-extra-pages',
    code: '01',
    name: 'Extra pages',
    dishName: 'Layered Tamago Nigiri',
    sushiCorrelation:
      'Cooked by folding thin golden layers one on top of another — just like stacking extra custom pages onto your website.',
    description:
      'Need more than your base page count? We design and code additional custom pages from scratch to match your site.',
    details: ['Custom drawn layout', 'Mobile responsive', 'Fast load speed', '₹9,999 addition'],
    price: '₹9,999',
    priceNumber: ADD_ON_PRICE,
    tier: 1,
    image: '/assets/sushi/tamago.webp',
  },
  {
    id: 'addon-admins',
    code: '02',
    name: 'Admins',
    dishName: 'Matcha & Berry Mochi Duo',
    sushiCorrelation:
      'Neatly paired and portioned side-by-side on one plate — matching a clean private admin dashboard where all your controls sit in one view.',
    description:
      'A private, easy-to-use admin control panel so you can view inquiries, manage listings, update content, and track orders yourself.',
    details: ['Private login', 'Manage leads & orders', 'Edit listings & content', '₹9,999 addition'],
    price: '₹9,999',
    priceNumber: ADD_ON_PRICE,
    tier: 3,
    image: '/assets/sushi/mochi.webp',
  },
  {
    id: 'addon-payment-integrations',
    code: '03',
    name: 'Payment integrations',
    dishName: 'Ebi Nigiri',
    sushiCorrelation:
      'Butterflied and ready to serve in one clean bite — matching a smooth, frictionless payment gateway & checkout integration.',
    description:
      'Accept UPI, cards, and netbanking directly on your site with Razorpay, Stripe, or Cashfree integrated and tested end-to-end.',
    details: ['UPI & Card checkout', 'Webhook verification', 'Tested live transactions', '₹9,999 addition'],
    price: '₹9,999',
    priceNumber: ADD_ON_PRICE,
    tier: 2,
    image: '/assets/sushi/ebi-nigiri.webp',
  },
  {
    id: 'addon-third-party-integrations',
    code: '04',
    name: 'Third party integrations',
    dishName: 'Salted Edamame Pods',
    sushiCorrelation:
      'Multiple pods linked together in one bowl — matching how we connect your CRM, WhatsApp, analytics, and external tools into your site.',
    description:
      'Wire your website directly into WhatsApp APIs, Google Sheets, HubSpot, Zoho, or your existing internal software.',
    details: ['CRM & WhatsApp sync', 'Automated webhooks', 'Custom API wiring', '₹9,999 addition'],
    price: '₹9,999',
    priceNumber: ADD_ON_PRICE,
    tier: 1,
    image: '/assets/sushi/edamame.webp',
  },
];

export const BELT_DISHES: ConveyorDish[] = [
  {
    id: PLANS[0].id,
    name: `${PLANS[0].name} · ${PLANS[0].dishName}`,
    price: PLANS[0].priceFormatted,
    tier: PLANS[0].tier,
    description: `${PLANS[0].tagline}. ${PLANS[0].sushiCorrelation} (Note: Includes ONLY ₹29,999 features.)`,
    details: PLANS[0].features,
    image: PLANS[0].image,
  },
  {
    id: CORE_ADDONS[0].id,
    name: `${CORE_ADDONS[0].name} · ${CORE_ADDONS[0].dishName}`,
    price: CORE_ADDONS[0].price,
    tier: CORE_ADDONS[0].tier,
    description: `${CORE_ADDONS[0].description} (${CORE_ADDONS[0].sushiCorrelation})`,
    details: CORE_ADDONS[0].details,
    image: CORE_ADDONS[0].image,
  },
  {
    id: PLANS[1].id,
    name: `${PLANS[1].name} · ${PLANS[1].dishName}`,
    price: PLANS[1].priceFormatted,
    tier: PLANS[1].tier,
    description: `${PLANS[1].tagline}. ${PLANS[1].sushiCorrelation}`,
    details: PLANS[1].features,
    image: PLANS[1].image,
  },
  {
    id: CORE_ADDONS[1].id,
    name: `${CORE_ADDONS[1].name} · ${CORE_ADDONS[1].dishName}`,
    price: CORE_ADDONS[1].price,
    tier: CORE_ADDONS[1].tier,
    description: `${CORE_ADDONS[1].description} (${CORE_ADDONS[1].sushiCorrelation})`,
    details: CORE_ADDONS[1].details,
    image: CORE_ADDONS[1].image,
  },
  {
    id: PLANS[2].id,
    name: `${PLANS[2].name} · ${PLANS[2].dishName}`,
    price: PLANS[2].priceFormatted,
    tier: PLANS[2].tier,
    description: `${PLANS[2].tagline}. ${PLANS[2].sushiCorrelation}`,
    details: PLANS[2].features,
    image: PLANS[2].image,
  },
  {
    id: CORE_ADDONS[2].id,
    name: `${CORE_ADDONS[2].name} · ${CORE_ADDONS[2].dishName}`,
    price: CORE_ADDONS[2].price,
    tier: CORE_ADDONS[2].tier,
    description: `${CORE_ADDONS[2].description} (${CORE_ADDONS[2].sushiCorrelation})`,
    details: CORE_ADDONS[2].details,
    image: CORE_ADDONS[2].image,
  },
  {
    id: PLANS[3].id,
    name: `${PLANS[3].name} · ${PLANS[3].dishName}`,
    price: PLANS[3].priceFormatted,
    tier: PLANS[3].tier,
    description: `${PLANS[3].tagline}. ${PLANS[3].sushiCorrelation}`,
    details: PLANS[3].features,
    image: PLANS[3].image,
  },
  {
    id: CORE_ADDONS[3].id,
    name: `${CORE_ADDONS[3].name} · ${CORE_ADDONS[3].dishName}`,
    price: CORE_ADDONS[3].price,
    tier: CORE_ADDONS[3].tier,
    description: `${CORE_ADDONS[3].description} (${CORE_ADDONS[3].sushiCorrelation})`,
    details: CORE_ADDONS[3].details,
    image: CORE_ADDONS[3].image,
  },
];
