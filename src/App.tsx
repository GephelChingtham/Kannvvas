/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Lock, LogIn, LogOut, ShoppingBag, Trash2, X } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { HandWrittenTitle } from '@/components/ui/hand-writing-text';
import SushiConveyorMenu, { type ConveyorDish } from '@/components/ui/sushi-conveyor-menu';
import TextBlockAnimation from '@/components/ui/text-block-animation';
import {
  ADD_ON_PRICE,
  BELT_DISHES,
  CORE_ADDONS,
  PLANS,
  type PlanOption,
} from '@/src/data/menu-plates';
import {
  ADMIN_EMAIL,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  MAX_BOOKINGS,
  OperationType,
  SLOT_IDS,
  type SlotId,
} from '@/src/lib/firebase';

const CREDENTIALS_URL =
  'https://www.coursera.org/account/accomplishments/verify/895RXPX2DHPY?utm_source=link&utm_medium=certificate&utm_content=cert_image&utm_campaign=sharing_cta&utm_product=course';

interface BookingRecord {
  slotId: SlotId;
  clientId: string;
  budget: string;
  phoneNumber: string;
  email: string;
  name: string;
  notes: string;
  itemsSummary: string;
  cartTotal: number;
  createdAt?: Timestamp | null;
}

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export default function App() {
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [cartAddOnIds, setCartAddOnIds] = useState<string[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Auth & Admin State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // 5-Slot Occupancy & Admin Bookings State
  const [occupiedSlots, setOccupiedSlots] = useState<Record<SlotId, boolean>>({
    'slot-1': false,
    'slot-2': false,
    'slot-3': false,
    'slot-4': false,
    'slot-5': false,
  });
  const [adminBookings, setAdminBookings] = useState<Record<SlotId, BookingRecord | null>>({
    'slot-1': null,
    'slot-2': null,
    'slot-3': null,
    'slot-4': null,
    'slot-5': null,
  });

  // Booking Form State
  const [budget, setBudget] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const selectedPlans = PLANS.filter((p) => selectedPlanIds.includes(p.id));
  const selectedAddOns = CORE_ADDONS.filter((a) => cartAddOnIds.includes(a.id));

  const plansSubtotal = selectedPlans.reduce((sum, p) => sum + p.price, 0);
  const addOnsSubtotal = selectedAddOns.length * ADD_ON_PRICE;
  const cartTotal = plansSubtotal + addOnsSubtotal;
  const totalItemsInCart = selectedPlans.length + selectedAddOns.length;

  const occupiedCount = SLOT_IDS.filter((id) => occupiedSlots[id]).length;
  const isAtCapacity = occupiedCount >= MAX_BOOKINGS;

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.emailVerified) {
        if (currentUser.email === ADMIN_EMAIL) {
          setIsAdminUser(true);
        } else {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
            setIsAdminUser(adminSnap.exists());
          } catch {
            setIsAdminUser(false);
          }
        }
      } else {
        setIsAdminUser(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Listen to public occupancy of the 5 slots (slot-1 .. slot-5)
  useEffect(() => {
    const unsubs = SLOT_IDS.map((slotId) => {
      const path = `slots/${slotId}`;
      return onSnapshot(
        doc(db, 'slots', slotId),
        (snap) => {
          setOccupiedSlots((prev) => ({
            ...prev,
            [slotId]: snap.exists() && snap.data()?.occupied === true,
          }));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, path);
        }
      );
    });
    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // Listen to the 5 booking documents when signed in as Admin
  useEffect(() => {
    if (!authReady || !isAdminUser) {
      setAdminBookings({
        'slot-1': null,
        'slot-2': null,
        'slot-3': null,
        'slot-4': null,
        'slot-5': null,
      });
      return;
    }

    const unsubs = SLOT_IDS.map((slotId) => {
      const path = `bookings/${slotId}`;
      return onSnapshot(
        doc(db, 'bookings', slotId),
        (snap) => {
          setAdminBookings((prev) => ({
            ...prev,
            [slotId]: snap.exists() ? (snap.data() as BookingRecord) : null,
          }));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, path);
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, isAdminUser]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const togglePlan = (plan: PlanOption) => {
    setSubmitted(false);
    setSelectedPlanIds((prev) => {
      if (plan.id === 'plan-184999') {
        return prev.includes('plan-184999') ? [] : ['plan-184999'];
      }
      const withoutBundle = prev.filter((id) => id !== 'plan-184999');
      if (withoutBundle.includes(plan.id)) {
        return withoutBundle.filter((id) => id !== plan.id);
      }
      return [...withoutBundle, plan.id];
    });
  };

  const toggleAddOn = (id: string) => {
    setSubmitted(false);
    setCartAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBeltAdd = (dish: ConveyorDish) => {
    setSubmitted(false);
    const matchedPlan = PLANS.find((p) => p.id === dish.id);
    if (matchedPlan) {
      if (!selectedPlanIds.includes(matchedPlan.id)) {
        togglePlan(matchedPlan);
      }
      return;
    }
    const matchedAddOn = CORE_ADDONS.find((a) => a.id === dish.id);
    if (matchedAddOn && !cartAddOnIds.includes(matchedAddOn.id)) {
      setCartAddOnIds((prev) => [...prev, matchedAddOn.id]);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isAtCapacity) {
      setError('All 5 booking slots are currently full (5/5).');
      return;
    }

    const cleanBudget = budget.trim().slice(0, 120);
    if (!cleanBudget) {
      setError('Enter your budget.');
      return;
    }

    const cleanPhone = phoneNumber.trim().slice(0, 40);
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (cleanPhone.length < 7 || digitsOnly.length < 7) {
      setError('Enter your phone number.');
      return;
    }

    const cleanEmail = email.trim().slice(0, 160);
    if (cleanEmail.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email.');
      return;
    }

    const freeSlotId = SLOT_IDS.find((id) => !occupiedSlots[id]);
    if (!freeSlotId) {
      setError('All 5 booking slots are currently full (5/5).');
      return;
    }

    setSubmitting(true);
    try {
      let activeUser = auth.currentUser;
      if (!activeUser) {
        const credential = await signInWithPopup(auth, googleProvider);
        activeUser = credential.user;
      }

      if (!activeUser) {
        setError('Please sign in with Google to confirm your booking.');
        setSubmitting(false);
        return;
      }

      const itemsSummary = [
        ...selectedPlans.map((p) => `${p.priceFormatted} (${p.dishName})`),
        ...selectedAddOns.map((a) => `${a.name} ₹9,999 (${a.dishName})`),
      ]
        .join(', ')
        .slice(0, 800);

      const batch = writeBatch(db);
      batch.set(doc(db, 'slots', freeSlotId), {
        slotId: freeSlotId,
        occupied: true,
        clientId: activeUser.uid,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'bookings', freeSlotId), {
        slotId: freeSlotId,
        clientId: activeUser.uid,
        budget: cleanBudget,
        phoneNumber: cleanPhone,
        email: cleanEmail,
        name: name.trim().slice(0, 160),
        notes: notes.trim().slice(0, 1500),
        itemsSummary,
        cartTotal: Math.min(Math.max(0, cartTotal), 100000000),
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `bookings/${freeSlotId}`);
      }

      setSubmitted(true);
      setBudget('');
      setPhoneNumber('');
      setEmail('');
      setName('');
      setNotes('');
    } catch (err) {
      if (err instanceof Error && err.message.includes('auth/popup-closed-by-user')) {
        setError('Sign-in popup was closed before completing your booking.');
      } else {
        setError('Could not save booking. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminDeleteBooking = async (slotId: SlotId) => {
    setAdminError(null);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'bookings', slotId));
      batch.delete(doc(db, 'slots', slotId));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookings/${slotId}`);
    }
  };

  const handleAdminSignIn = async () => {
    setAdminError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setAdminError('Sign-in cancelled or failed.');
    }
  };

  const activeAdminBookingsList = SLOT_IDS.map((slotId) => adminBookings[slotId]).filter(
    (b): b is BookingRecord => b !== null
  );

  return (
    <div className="min-h-screen bg-[#C2D8C4] text-[#121214] selection:bg-[#121214] selection:text-[#FDFBF7]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-[#C2D8C4]/95 backdrop-blur-sm border-b-[0.5px] border-[#121214]/15">
        <div className="max-w-6xl mx-auto px-6 py-3 min-h-16 flex flex-wrap items-center justify-between gap-4">
          <a href="#top" className="text-lg font-black tracking-tighter text-[#121214]">
            KANNVVAS
          </a>

          <nav className="flex flex-wrap items-center gap-4 sm:gap-5">
            <button
              type="button"
              onClick={() => scrollToSection('what-we-do')}
              className="text-xs font-bold text-[#121214] hover:underline underline-offset-4 cursor-pointer"
            >
              What we do
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('why-us')}
              className="text-xs font-bold text-[#121214] hover:underline underline-offset-4 cursor-pointer"
            >
              Why we build
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('main-options')}
              className="text-xs font-bold text-[#121214] hover:underline underline-offset-4 cursor-pointer"
            >
              Options
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('belt')}
              className="text-xs font-bold text-[#121214] hover:underline underline-offset-4 cursor-pointer"
            >
              Belt
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('admin')}
              className="text-xs font-bold text-[#121214] hover:underline underline-offset-4 cursor-pointer"
            >
              Admin
            </button>
            <a
              href={CREDENTIALS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#121214] hover:underline underline-offset-4"
            >
              <span>Our credentials</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              className="inline-flex items-center gap-2 border border-[#121214] bg-[#FDFBF7] px-3 py-1.5 text-xs font-mono font-bold text-[#121214] hover:bg-[#121214] hover:text-[#FDFBF7] transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{totalItemsInCart}</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('book')}
              className="bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none px-4 py-2 cursor-pointer"
            >
              BOOK
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* 1. FULL-VIEWPORT LANDING HERO */}
        <section className="min-h-[calc(100vh-4rem)] max-w-6xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center border-b-[0.5px] border-[#121214]/15">
          <a
            href={CREDENTIALS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#121214] border-b border-[#121214] pb-0.5"
          >
            <span>OUR CREDENTIALS</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>

          <HandWrittenTitle title="The next big conversion engineering studio" />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => scrollToSection('main-options')}
              className="bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none px-7 py-3.5 cursor-pointer"
            >
              SEE MAIN OPTIONS ↓
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('belt')}
              className="bg-[#FDFBF7] text-[#121214] border border-[#121214] font-black uppercase text-xs tracking-widest rounded-none px-7 py-3.5 hover:bg-[#121214] hover:text-[#FDFBF7] transition-colors cursor-pointer"
            >
              OPEN THE BELT ↓
            </button>
          </div>
        </section>

        {/* 2. WHAT WE DO — ANIMATED ON SCROLL WITH GSAP + REACT TEXTBLOCKANIMATION */}
        <section
          id="what-we-do"
          className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-b-[0.5px] border-[#121214]/15"
        >
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-mono uppercase tracking-widest text-[#3A403C] mb-3">
              What We Do
            </p>
            <TextBlockAnimation blockColor="#121214" animateOnScroll={true} duration={0.7}>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight text-[#121214]">
                We build websites that turn visitors into phone calls, WhatsApp messages, and paid orders.
              </h2>
            </TextBlockAnimation>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FDFBF7] border border-[#121214] p-7 space-y-4">
              <span className="text-xs font-mono font-bold text-[#3A403C] block">01</span>
              <TextBlockAnimation blockColor="#121214" animateOnScroll={true} duration={0.55}>
                <h3 className="text-xl font-black tracking-tight text-[#121214]">
                  Custom Frontends Drawn From Scratch
                </h3>
              </TextBlockAnimation>
              <TextBlockAnimation
                blockColor="#3A403C"
                animateOnScroll={true}
                stagger={0.04}
                duration={0.5}
              >
                <p className="text-sm text-[#3A403C] leading-relaxed">
                  We don’t slap your logo onto a slow WordPress theme. Every page is designed and coded around your product or service so it loads fast on mobile, looks sharp on every screen, and keeps people from bouncing.
                </p>
              </TextBlockAnimation>
            </div>

            <div className="bg-[#FDFBF7] border border-[#121214] p-7 space-y-4">
              <span className="text-xs font-mono font-bold text-[#3A403C] block">02</span>
              <TextBlockAnimation blockColor="#121214" animateOnScroll={true} duration={0.55}>
                <h3 className="text-xl font-black tracking-tight text-[#121214]">
                  Lead Capture &amp; One-Tap WhatsApp Flows
                </h3>
              </TextBlockAnimation>
              <TextBlockAnimation
                blockColor="#3A403C"
                animateOnScroll={true}
                stagger={0.04}
                duration={0.5}
              >
                <p className="text-sm text-[#3A403C] leading-relaxed">
                  Most websites bury their contact info three clicks deep. We structure your service pages, galleries, and inquiry forms around how your customers actually buy—with direct WhatsApp buttons and clean lead capture.
                </p>
              </TextBlockAnimation>
            </div>

            <div className="bg-[#FDFBF7] border border-[#121214] p-7 space-y-4">
              <span className="text-xs font-mono font-bold text-[#3A403C] block">03</span>
              <TextBlockAnimation blockColor="#121214" animateOnScroll={true} duration={0.55}>
                <h3 className="text-xl font-black tracking-tight text-[#121214]">
                  Payments, Checkout &amp; Analytics
                </h3>
              </TextBlockAnimation>
              <TextBlockAnimation
                blockColor="#3A403C"
                animateOnScroll={true}
                stagger={0.04}
                duration={0.5}
              >
                <p className="text-sm text-[#3A403C] leading-relaxed">
                  When your business needs to collect money online, we integrate and test your payment gateway, lock down SSL and security, and set up conversion tracking so you can see which pages actually bring in revenue.
                </p>
              </TextBlockAnimation>
            </div>
          </div>
        </section>

        {/* 3. WHY WE BUILD */}
        <section
          id="why-us"
          className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-b-[0.5px] border-[#121214]/15"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-mono uppercase tracking-widest text-[#3A403C] mb-2">
                Why We Build
              </p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-[#121214]">
                Why we started KANNVVAS.
              </h2>
            </div>

            <div className="lg:col-span-7 bg-[#FDFBF7] border border-[#121214] p-7 sm:p-9 space-y-5 text-sm sm:text-base text-[#121214] leading-relaxed">
              <p className="font-bold text-lg">
                Right now, if you want a website built for your business, you usually get burned one of two ways.
              </p>
              <p className="text-[#3A403C]">
                Either you hire a traditional agency that charges you lakhs, drags a simple build out for three months, and hands you a clunky template—or you hire someone who pastes together generic AI-generated pages that look identical to everyone else and don’t bring in a single customer.
              </p>
              <p className="text-[#3A403C]">
                We are building KANNVVAS because business owners deserve straight answers and working code. No hourly billing games, no fake tech jargon, and no bloated menus of things you don’t need.
              </p>
              <p className="font-bold">
                You tell us your budget, pick the exact pieces your business needs, and we build a fast, clean system that helps you close more clients.
              </p>
            </div>
          </div>
        </section>

        {/* 4. THE MAIN OPTIONS (ONLY THE 4 MAIN PLANS) */}
        <section
          id="main-options"
          className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-b-[0.5px] border-[#121214]/15"
        >
          <div className="mb-8 space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-[#3A403C]">
              Main Options
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-[#121214]">
              Pick Your Main Plan
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#121214] bg-[#FDFBF7] border border-[#121214] px-4 py-3">
              If you pick the ₹29,999 plan, you get ONLY those features. If you want the ₹64,999 features too, you have to pay the extra ₹64,999.
            </p>
          </div>

          {/* 3 Main Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {PLANS.slice(0, 3).map((plan) => {
              const isSelected = selectedPlanIds.includes(plan.id);
              return (
                <div
                  key={plan.id}
                  onClick={() => togglePlan(plan)}
                  className={`bg-[#FDFBF7] p-6 flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-2 border-[#121214]'
                      : 'border-[0.5px] border-[#121214]/25 hover:border-[#121214]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <span className="text-3xl font-black font-mono tabular-nums tracking-tighter text-[#121214] block">
                          {plan.priceFormatted}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#121214]">
                          Plate: {plan.dishName}
                        </span>
                      </div>
                      <img
                        src={plan.image}
                        alt={plan.dishName}
                        className="w-20 h-20 object-contain shrink-0 select-none"
                      />
                    </div>

                    <p className="text-xs bg-[#C2D8C4]/35 border-l-2 border-[#121214] px-3 py-2 text-[#121214] mb-4">
                      {plan.sushiCorrelation}
                    </p>

                    <p className="text-xs font-bold text-[#121214] mb-3">{plan.tagline}</p>

                    <ul className="space-y-2 mb-6 text-xs text-[#3A403C]">
                      {plan.features.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlan(plan);
                    }}
                    className={`w-full font-black uppercase text-xs tracking-widest rounded-none py-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#121214] text-[#FDFBF7]'
                        : 'bg-[#FDFBF7] text-[#121214] border border-[#121214] hover:bg-[#121214] hover:text-[#FDFBF7]'
                    }`}
                  >
                    {isSelected ? `Selected (${plan.priceFormatted})` : `Select ${plan.priceFormatted}`}
                  </button>
                </div>
              );
            })}
          </div>

          {/* ₹1,84,999 All Three Bundle */}
          {(() => {
            const bundle = PLANS[3];
            const isSelected = selectedPlanIds.includes(bundle.id);
            return (
              <div
                onClick={() => togglePlan(bundle)}
                className={`bg-[#FDFBF7] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                  isSelected
                    ? 'border-2 border-[#121214]'
                    : 'border-[0.5px] border-[#121214]/25 hover:border-[#121214]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={bundle.image}
                    alt={bundle.dishName}
                    className="w-20 h-20 object-contain shrink-0 select-none"
                  />
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tighter text-[#121214]">
                        {bundle.priceFormatted}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#121214]">
                        · Plate: {bundle.dishName}
                      </span>
                    </div>
                    <p className="text-xs text-[#121214] mt-1">{bundle.sushiCorrelation}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlan(bundle);
                  }}
                  className="bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none px-6 py-3.5 whitespace-nowrap cursor-pointer"
                >
                  {isSelected ? 'Selected (₹1,84,999)' : 'Select ₹1,84,999'}
                </button>
              </div>
            );
          })()}
        </section>

        {/* 5. THE BELT — ADDITIONS & PLANS LIVE ON THE BELT */}
        <section id="belt" className="w-full border-b-[0.5px] border-[#121214]/15">
          <SushiConveyorMenu
            items={BELT_DISHES}
            heading="Grab your plan & additions off the belt"
            speed={38}
            onAdd={handleBeltAdd}
            labels={{
              add: 'Add to cart',
              close: 'Close',
              previous: 'Previous',
              next: 'Next',
              pause: 'Pause',
            }}
          />
        </section>

        {/* 6. CLIENT BOOKING (MAX 5 BOOKINGS AT A TIME) */}
        <section
          id="book"
          className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-b-[0.5px] border-[#121214]/15"
        >
          <div className="max-w-xl mx-auto bg-[#FDFBF7] border border-[#121214] p-7 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-[#121214]">
                Book Your Build
              </h2>
              <span className="border border-[#121214] bg-[#C2D8C4] px-2.5 py-1 text-xs font-mono font-bold text-[#121214]">
                {occupiedCount} / {MAX_BOOKINGS} Slots Booked
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#3A403C] mb-6">
              We take a maximum of 5 bookings at a time. Drop your budget, phone number, and email—we reach out directly within a couple days.
            </p>

            {totalItemsInCart > 0 && (
              <div className="mb-6 pb-4 border-b border-[#121214]/15 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlans.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 bg-[#121214] text-[#FDFBF7] px-2.5 py-1 text-xs font-mono"
                    >
                      {p.priceFormatted} · {p.dishName}
                      <button
                        type="button"
                        onClick={() => togglePlan(p)}
                        className="hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {selectedAddOns.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 bg-[#C2D8C4] text-[#121214] border border-[#121214] px-2.5 py-1 text-xs font-mono"
                    >
                      {a.name} (₹9,999)
                      <button
                        type="button"
                        onClick={() => toggleAddOn(a.id)}
                        className="hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <p className="text-xs font-mono font-bold text-[#121214]">
                  Cart Total: {formatINR(cartTotal)}
                </p>
              </div>
            )}

            {submitted ? (
              <div className="space-y-4">
                <div className="p-5 bg-[#C2D8C4]/40 border border-[#121214] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#121214]">
                    <Check className="w-4 h-4" />
                    <span>Booked</span>
                  </div>
                  <p className="text-base font-bold text-[#121214] leading-snug">
                    You are going to hear from us again within a couple days — we will contact and reach out to you directly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none px-5 py-2.5 cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : isAtCapacity ? (
              <div className="p-5 border border-[#121214] bg-[#C2D8C4]/40 space-y-2">
                <p className="text-sm font-black uppercase tracking-widest text-[#121214]">
                  All 5 Booking Slots Are Full (5 / 5)
                </p>
                <p className="text-xs text-[#3A403C]">
                  We only take 5 client builds at a time so every build gets finished fast. Please check back once a slot opens up.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} noValidate className="space-y-4">
                {error && (
                  <div className="p-2.5 border border-[#121214] bg-[#C2D8C4]/40 text-xs font-mono text-[#121214]">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="book-budget" className="block text-xs font-bold text-[#121214] mb-1">
                    Your Budget (₹) *
                  </label>
                  <input
                    id="book-budget"
                    type="text"
                    required
                    maxLength={120}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. ₹35,000 or ₹1,00,000"
                    className="w-full bg-[#FDFBF7] border border-[#121214] px-3.5 py-2.5 text-sm text-[#121214] rounded-none focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="book-phone" className="block text-xs font-bold text-[#121214] mb-1">
                      Phone Number *
                    </label>
                    <input
                      id="book-phone"
                      type="tel"
                      required
                      maxLength={40}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-[#FDFBF7] border border-[#121214] px-3.5 py-2.5 text-sm text-[#121214] rounded-none focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="book-email" className="block text-xs font-bold text-[#121214] mb-1">
                      Email *
                    </label>
                    <input
                      id="book-email"
                      type="email"
                      required
                      maxLength={160}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-[#FDFBF7] border border-[#121214] px-3.5 py-2.5 text-sm text-[#121214] rounded-none focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="book-name" className="block text-xs font-bold text-[#121214] mb-1">
                    Name / Business
                  </label>
                  <input
                    id="book-name"
                    type="text"
                    maxLength={160}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-[#FDFBF7] border border-[#121214] px-3.5 py-2.5 text-sm text-[#121214] rounded-none focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="book-notes" className="block text-xs font-bold text-[#121214] mb-1">
                    What do you need built?
                  </label>
                  <textarea
                    id="book-notes"
                    rows={3}
                    maxLength={1500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tell us about your business and what you want on the site..."
                    className="w-full bg-[#FDFBF7] border border-[#121214] p-3 text-sm text-[#121214] rounded-none focus:outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none py-4 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Booking...' : 'Book Now'}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* 7. ADMIN SECTION — SHOWING ALL BOOKINGS (MAX 5 PER TIME) */}
        <section id="admin" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="bg-[#FDFBF7] border border-[#121214] p-7 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#121214]/15">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-[#3A403C] mb-1">
                  Admin Section
                </p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-[#121214]">
                  Active Bookings ({occupiedCount} / {MAX_BOOKINGS})
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {user ? (
                  <>
                    <span className="text-xs font-mono text-[#3A403C] hidden sm:inline">
                      {user.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => signOut(auth)}
                      className="inline-flex items-center gap-1.5 border border-[#121214] bg-[#FDFBF7] px-3.5 py-2 text-xs font-bold uppercase tracking-widest text-[#121214] hover:bg-[#121214] hover:text-[#FDFBF7] transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleAdminSignIn}
                    className="inline-flex items-center gap-1.5 bg-[#121214] text-[#FDFBF7] px-4 py-2.5 text-xs font-black uppercase tracking-widest cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Admin Sign In</span>
                  </button>
                )}
              </div>
            </div>

            {adminError && (
              <div className="mt-4 p-3 border border-[#121214] bg-[#C2D8C4]/40 text-xs font-mono text-[#121214]">
                {adminError}
              </div>
            )}

            {!user ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
                <Lock className="w-6 h-6 text-[#121214]" />
                <p className="text-sm font-bold text-[#121214]">
                  Sign in with your admin Google account to view and manage all 5 booking slots.
                </p>
              </div>
            ) : !isAdminUser ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
                <Lock className="w-6 h-6 text-[#121214]" />
                <p className="text-sm font-bold text-[#121214]">
                  Signed in as {user.email} (Not an Admin).
                </p>
                <p className="text-xs text-[#3A403C]">
                  Only authorized admins can view client bookings.
                </p>
              </div>
            ) : activeAdminBookingsList.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-mono text-[#3A403C]">
                  0 / 5 bookings right now. All 5 slots are open.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {activeAdminBookingsList.map((b) => (
                  <div
                    key={b.slotId}
                    className="border border-[#121214] bg-[#C2D8C4]/25 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="bg-[#121214] text-[#FDFBF7] px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase">
                          {b.slotId.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#121214]">
                          Budget: {b.budget}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="font-bold text-sm text-[#121214]">
                          {b.name || 'Unnamed Client'}
                        </p>
                        <p className="font-mono text-[#121214]">Phone: {b.phoneNumber}</p>
                        <p className="font-mono text-[#121214]">Email: {b.email}</p>
                      </div>

                      {b.itemsSummary && (
                        <div className="border-t border-[#121214]/15 pt-2 text-xs font-mono text-[#121214]">
                          <span className="font-bold block">Selected Items ({formatINR(b.cartTotal)}):</span>
                          <span className="text-[#3A403C]">{b.itemsSummary}</span>
                        </div>
                      )}

                      {b.notes && (
                        <div className="border-t border-[#121214]/15 pt-2 text-xs text-[#3A403C]">
                          <span className="font-bold text-[#121214] block">Notes:</span>
                          {b.notes}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAdminDeleteBooking(b.slotId)}
                      className="inline-flex items-center justify-center gap-1.5 border border-[#121214] bg-[#FDFBF7] py-2 px-3 text-xs font-bold uppercase tracking-widest text-[#121214] hover:bg-[#121214] hover:text-[#FDFBF7] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Booking &amp; Free Slot</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* SLIDE-OVER CART DRAWER */}
      {isCartDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cart"
          className="fixed inset-0 z-50 bg-[#121214]/70 flex justify-end"
        >
          <div className="bg-[#FDFBF7] border-l border-[#121214] w-full max-w-sm h-full p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#121214]/15">
                <h2 className="text-base font-black text-[#121214]">Cart ({totalItemsInCart})</h2>
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="p-1 border border-[#121214] text-[#121214] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {totalItemsInCart === 0 ? (
                <p className="text-xs text-[#3A403C]">Nothing added yet.</p>
              ) : (
                <ul className="space-y-2.5 text-xs">
                  {selectedPlans.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img src={p.image} alt="" className="w-8 h-8 object-contain" />
                        <div>
                          <span className="font-bold text-[#121214] block">{p.name}</span>
                          <span className="text-[10px] font-mono text-[#3A403C]">{p.dishName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{p.priceFormatted}</span>
                        <button
                          type="button"
                          onClick={() => togglePlan(p)}
                          className="text-[#3A403C] hover:text-[#121214] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                  {selectedAddOns.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img src={a.image} alt="" className="w-8 h-8 object-contain" />
                        <div>
                          <span className="font-bold text-[#121214] block">{a.name}</span>
                          <span className="text-[10px] font-mono text-[#3A403C]">{a.dishName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">₹9,999</span>
                        <button
                          type="button"
                          onClick={() => toggleAddOn(a.id)}
                          className="text-[#3A403C] hover:text-[#121214] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[#121214] pt-4 space-y-3">
              <div className="flex justify-between text-sm font-black font-mono text-[#121214]">
                <span>Total</span>
                <span>{formatINR(cartTotal)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  scrollToSection('book');
                }}
                className="w-full bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none py-3 cursor-pointer"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
