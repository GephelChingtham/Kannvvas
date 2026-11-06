/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Phone,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
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

const REQUIRED_PASSCODE = 'Zayden@08';

// ==========================================
// INTAKE QUESTIONNAIRE CONSTANTS
// ==========================================
const Q1_OPTIONS = [
  'Bold & Disruptive (Energetic, high-contrast, modern)',
  'Premium & Luxurious (Sophisticated, minimalist, high-end)',
  'Friendly & Approachable (Warm, creative, community-focused)',
  'Corporate & Trustworthy (Professional, secure, data-driven)',
  'Technical & Cutting-Edge (SaaS, developer-focused, futuristic)',
  'Calm & Organic (Eco-friendly, wellness-oriented, soft tones)',
];

const Q3_OPTIONS = [
  'Book a call / Schedule a demo (Lead generation focus)',
  'Purchase a product (E-commerce / transaction focus)',
  'Sign up for a free trial / Create an account (SaaS product focus)',
  'Read our content / View our work (Portfolio / publisher focus)',
  'Contact us / Fill out a quote form (Local business / service focus)',
];

const Q4_OPTIONS = [
  'Text-Heavy: Deep-dive blogs, whitepapers, case studies, or documentation.',
  'Visual-Heavy: High-resolution product images, video backgrounds, or design portfolios.',
  'Transaction-Heavy: Complex pricing grids, booking systems, or large e-commerce catalogs.',
  'Minimal Content: Simple, straight-to-the-point landing page with just core business details.',
];

const Q5_OPTIONS = [
  'Non-technical / Traditional: Needs ultra-simple, predictable navigation and highly readable fonts (e.g., enterprise executives, seniors, general consumers).',
  'Moderately Tech-Savvy: Comfortable with standard modern web layouts, interactive sliders, and typical SaaS layouts (e.g., everyday professionals, B2B buyers).',
  'Highly Tech-Savvy / Early Adopters: Expects experimental design, micro-animations, dark mode, and cutting-edge visual trends (e.g., developers, creatives, Gen-Z).',
];

const Q6_OPTIONS = [
  'Fully Loaded: We have custom, high-end professional photography and brand illustrations ready.',
  'Text Only: We do not have high-quality photos yet; we will rely heavily on typography, clean layouts, and vector/stock icons.',
  'Hybrid: We have standard team photos or basic product screenshots, but will need high-quality stock photography to fill the gaps.',
];

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
  q1BrandPersonality?: string;
  q2FavoriteWebsites?: string;
  q3PrimaryGoal?: string;
  q4ContentReliance?: string;
  q5TargetAudience?: string;
  q6VisualAssetsScope?: string;
  createdAt?: Timestamp | null;
}

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export default function App() {
  // Client-Side Routing: Detect /admin or #admin
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p.startsWith('/admin') || h.includes('admin')) {
        return '/admin';
      }
      return p || '/';
    }
    return '/';
  });

  // Admin Passcode Gate (Zayden@08)
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('kannvvas_admin_unlocked') === 'true';
    }
    return false;
  });

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

  // Booking Form State - Contact & Basics
  const [budget, setBudget] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Booking Form State - 6 Intake Questions
  const [q1Selected, setQ1Selected] = useState<string[]>([]);
  const [q2Websites, setQ2Websites] = useState('');
  const [q3Goal, setQ3Goal] = useState('');
  const [q4Content, setQ4Content] = useState<string[]>([]);
  const [q5Audience, setQ5Audience] = useState('');
  const [q6Assets, setQ6Assets] = useState('');

  // Active step in booking: 1 = Basic Details, 2 = Intake Questionnaire
  const [bookingStep, setBookingStep] = useState<1 | 2>(1);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [expandedIntakeSlot, setExpandedIntakeSlot] = useState<SlotId | null>(null);

  const selectedPlans = PLANS.filter((p) => selectedPlanIds.includes(p.id));
  const selectedAddOns = CORE_ADDONS.filter((a) => cartAddOnIds.includes(a.id));

  const plansSubtotal = selectedPlans.reduce((sum, p) => sum + p.price, 0);
  const addOnsSubtotal = selectedAddOns.length * ADD_ON_PRICE;
  const cartTotal = plansSubtotal + addOnsSubtotal;
  const totalItemsInCart = selectedPlans.length + selectedAddOns.length;

  const occupiedCount = SLOT_IDS.filter((id) => occupiedSlots[id]).length;
  const isAtCapacity = occupiedCount >= MAX_BOOKINGS;

  // Handle URL change / Browser back & forward
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      const h = window.location.hash;
      if (p.startsWith('/admin') || h.includes('admin')) {
        setPathname('/admin');
      } else {
        setPathname(p || '/');
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
      setPathname(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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

  const toggleQ1 = (opt: string) => {
    setQ1Selected((prev) => {
      if (prev.includes(opt)) {
        return prev.filter((x) => x !== opt);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), opt];
      }
      return [...prev, opt];
    });
  };

  const toggleQ4 = (opt: string) => {
    setQ4Content((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  const validateStep1 = () => {
    setError(null);
    if (isAtCapacity) {
      setError('All 5 booking slots are currently full (5/5).');
      return false;
    }
    const cleanBudget = budget.trim().slice(0, 120);
    if (!cleanBudget) {
      setError('Please enter your budget.');
      return false;
    }
    const cleanPhone = phoneNumber.trim().slice(0, 40);
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (cleanPhone.length < 7 || digitsOnly.length < 7) {
      setError('Please enter a valid phone number.');
      return false;
    }
    const cleanEmail = email.trim().slice(0, 160);
    if (cleanEmail.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleProceedToIntake = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setBookingStep(2);
      const intakeElement = document.getElementById('intake-questionnaire');
      if (intakeElement) {
        intakeElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateStep1()) {
      setBookingStep(1);
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
        setError('Please sign in with Google to confirm and save your booking.');
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
        budget: budget.trim().slice(0, 120),
        phoneNumber: phoneNumber.trim().slice(0, 40),
        email: email.trim().slice(0, 160),
        name: name.trim().slice(0, 160),
        notes: notes.trim().slice(0, 1500),
        itemsSummary,
        cartTotal: Math.min(Math.max(0, cartTotal), 100000000),
        q1BrandPersonality: q1Selected.join(' | ').slice(0, 400),
        q2FavoriteWebsites: q2Websites.trim().slice(0, 1500),
        q3PrimaryGoal: q3Goal.slice(0, 300),
        q4ContentReliance: q4Content.join(' | ').slice(0, 500),
        q5TargetAudience: q5Audience.slice(0, 400),
        q6VisualAssetsScope: q6Assets.slice(0, 400),
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `bookings/${freeSlotId}`);
      }

      setSubmitted(true);
      setBookingStep(1);
      setBudget('');
      setPhoneNumber('');
      setEmail('');
      setName('');
      setNotes('');
      setQ1Selected([]);
      setQ2Websites('');
      setQ3Goal('');
      setQ4Content([]);
      setQ5Audience('');
      setQ6Assets('');
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

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError(null);
    if (passcodeInput === REQUIRED_PASSCODE) {
      setIsPasscodeUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('kannvvas_admin_unlocked', 'true');
      }
      setPasscodeInput('');
    } else {
      setPasscodeError('Invalid passcode. Access denied.');
    }
  };

  const handleLockAdmin = () => {
    setIsPasscodeUnlocked(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kannvvas_admin_unlocked');
    }
  };

  const activeAdminBookingsList = SLOT_IDS.map((slotId) => ({
    slotId,
    occupied: occupiedSlots[slotId],
    booking: adminBookings[slotId],
  }));

  // ==========================================
  // DEDICATED ADMIN PORTAL VIEW (/admin)
  // ==========================================
  if (pathname === '/admin') {
    return (
      <div className="min-h-screen bg-[#121214] text-[#FDFBF7] selection:bg-[#C2D8C4] selection:text-[#121214] flex flex-col font-sans">
        {/* TOP ADMIN HEADER */}
        <header className="border-b border-[#FDFBF7]/15 bg-[#121214]/90 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-black tracking-widest uppercase bg-[#FDFBF7] text-[#121214] px-2 py-0.5">
                KANNVVAS
              </span>
              <span className="font-mono text-xs text-[#FDFBF7]/60 tracking-wider">
                /admin portal
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#FDFBF7]/70 hover:text-[#FDFBF7] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Site</span>
              </button>

              {isPasscodeUnlocked && (
                <button
                  type="button"
                  onClick={handleLockAdmin}
                  className="border border-[#FDFBF7]/30 hover:border-[#FDFBF7] bg-transparent text-[#FDFBF7] px-3 py-1.5 text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer"
                >
                  Lock
                </button>
              )}
            </div>
          </div>
        </header>

        {/* PASSCODE GATE: Zayden@08 */}
        {!isPasscodeUnlocked ? (
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full border border-[#FDFBF7]/20 bg-[#1A1C1A] p-8 sm:p-10 shadow-2xl space-y-6">
              <div className="space-y-2 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 border border-[#FDFBF7]/30 bg-[#121214] text-[#FDFBF7] mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#FDFBF7]">
                  Admin Authorization
                </h1>
                <p className="text-xs font-mono text-[#FDFBF7]/60 tracking-wide">
                  https://kannvvas.vercel.app/admin
                </p>
              </div>

              {passcodeError && (
                <div className="p-3 border border-red-500/50 bg-red-950/40 text-red-300 text-xs font-mono text-center">
                  {passcodeError}
                </div>
              )}

              <form onSubmit={handlePasscodeSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-passcode-input"
                    className="block text-xs font-mono uppercase tracking-widest text-[#FDFBF7]/70 mb-2"
                  >
                    Enter Passcode
                  </label>
                  <div className="relative">
                    <input
                      id="admin-passcode-input"
                      type={showPasscode ? 'text' : 'password'}
                      autoFocus
                      required
                      value={passcodeInput}
                      onChange={(e) => {
                        setPasscodeInput(e.target.value);
                        setPasscodeError(null);
                      }}
                      placeholder="•••••••••"
                      className="w-full bg-[#121214] border border-[#FDFBF7]/30 focus:border-[#FDFBF7] text-[#FDFBF7] px-4 py-3 text-sm font-mono tracking-wider outline-none rounded-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FDFBF7]/60 hover:text-[#FDFBF7] p-1 cursor-pointer"
                    >
                      {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#FDFBF7] text-[#121214] font-black uppercase text-xs tracking-widest py-3.5 hover:bg-[#C2D8C4] transition-colors cursor-pointer"
                >
                  Verify Passcode →
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigateTo('/')}
                  className="text-xs font-mono text-[#FDFBF7]/50 hover:text-[#FDFBF7] underline underline-offset-4 cursor-pointer"
                >
                  ← Back to Kannvvas Studio
                </button>
              </div>
            </div>
          </main>
        ) : (
          /* UNLOCKED ADMIN DASHBOARD */
          <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-10 space-y-8">
            {/* TOP BAR / STATS */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#FDFBF7]/15 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-widest text-[#FDFBF7]/70">
                    Live System Status
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[#FDFBF7] mt-1">
                  Active Bookings &amp; Questionnaire Intake
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-wider border border-[#FDFBF7]/30 px-3 py-1.5 bg-[#1A1C1A]">
                  Slots: <strong className="text-[#C2D8C4]">{occupiedCount}</strong> / {MAX_BOOKINGS}
                </span>

                {user ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#FDFBF7]/60 hidden sm:inline">
                      {user.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => signOut(auth)}
                      className="border border-[#FDFBF7]/30 hover:border-[#FDFBF7] px-3 py-1.5 text-xs font-mono uppercase tracking-wider cursor-pointer"
                    >
                      Sign Out Google
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAdminSignIn}
                    className="inline-flex items-center gap-2 bg-[#FDFBF7] text-[#121214] px-4 py-2 text-xs font-mono font-bold tracking-wider uppercase hover:bg-[#C2D8C4] cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sync Google Admin</span>
                  </button>
                )}
              </div>
            </div>

            {adminError && (
              <div className="p-3 border border-red-500/50 bg-red-950/40 text-red-300 text-xs font-mono">
                {adminError}
              </div>
            )}

            {!user ? (
              <div className="border border-[#FDFBF7]/20 bg-[#1A1C1A] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-sm font-bold text-[#FDFBF7]">
                    Passcode verified ({REQUIRED_PASSCODE})
                  </p>
                  <p className="text-xs font-mono text-[#FDFBF7]/60">
                    Connect your admin Google account ({ADMIN_EMAIL}) to unlock real-time Firestore database reads and manage questionnaire answers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAdminSignIn}
                  className="bg-[#C2D8C4] text-[#121214] font-black uppercase text-xs tracking-widest px-5 py-3 whitespace-nowrap hover:bg-[#FDFBF7] cursor-pointer"
                >
                  Connect {ADMIN_EMAIL}
                </button>
              </div>
            ) : !isAdminUser ? (
              <div className="border border-amber-500/50 bg-amber-950/30 p-6 space-y-2">
                <p className="text-sm font-bold text-amber-300">
                  Logged in as {user.email} (Not Registered as Firebase Admin)
                </p>
                <p className="text-xs font-mono text-[#FDFBF7]/70">
                  Make sure you sign in with the official admin email ({ADMIN_EMAIL}) to view client intake answers.
                </p>
              </div>
            ) : null}

            {/* 5-SLOT ARCHITECTURAL PIPELINE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono uppercase tracking-widest text-[#FDFBF7]/70">
                  Current 5 Client Slots
                </h2>
                <span className="text-xs font-mono text-[#FDFBF7]/50">
                  Strict Limit: 5 simultaneous builds
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAdminBookingsList.map(({ slotId, occupied, booking }, index) => {
                  const slotLabel = `SLOT 0${index + 1}`;
                  const isIntakeOpen = expandedIntakeSlot === slotId;

                  if (!occupied) {
                    return (
                      <div
                        key={slotId}
                        className="border border-dashed border-[#FDFBF7]/25 bg-[#121214]/60 p-6 flex flex-col justify-between min-h-[280px]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <span className="font-mono text-xs font-bold text-[#FDFBF7]/50">
                              {slotLabel}
                            </span>
                            <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/50 border border-emerald-500/40 px-2 py-0.5">
                              OPEN
                            </span>
                          </div>
                          <p className="text-base font-bold text-[#FDFBF7]/80">Available</p>
                          <p className="text-xs font-mono text-[#FDFBF7]/40 mt-1">
                            Ready for next client off the sushi belt.
                          </p>
                        </div>

                        <div className="pt-4 border-t border-[#FDFBF7]/10">
                          <span className="text-[11px] font-mono text-[#FDFBF7]/40">
                            ID: {slotId}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slotId}
                      className="border border-[#C2D8C4]/60 bg-[#1A1C1A] p-6 flex flex-col justify-between space-y-4 min-h-[280px] shadow-lg"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#FDFBF7]/15">
                          <span className="font-mono text-xs font-black text-[#C2D8C4] tracking-wider">
                            {slotLabel}
                          </span>
                          <span className="font-mono text-[11px] font-bold bg-[#C2D8C4] text-[#121214] px-2.5 py-0.5 uppercase">
                            BOOKED
                          </span>
                        </div>

                        {booking ? (
                          <div className="space-y-3 text-xs font-mono">
                            <div>
                              <p className="text-base font-bold text-[#FDFBF7] font-sans">
                                {booking.name || 'Unnamed Client'}
                              </p>
                              <p className="text-sm font-black text-[#C2D8C4] mt-0.5">
                                Budget: {booking.budget}
                              </p>
                            </div>

                            <div className="space-y-1.5 pt-1 text-[#FDFBF7]/80">
                              <p className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-[#C2D8C4]" />
                                <a
                                  href={`tel:${booking.phoneNumber}`}
                                  className="hover:underline"
                                >
                                  {booking.phoneNumber}
                                </a>
                                <a
                                  href={`https://wa.me/${booking.phoneNumber.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2"
                                >
                                  WhatsApp
                                </a>
                              </p>

                              <p className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-[#C2D8C4]" />
                                <a
                                  href={`mailto:${booking.email}`}
                                  className="hover:underline truncate"
                                >
                                  {booking.email}
                                </a>
                              </p>
                            </div>

                            {booking.itemsSummary && (
                              <div className="pt-2 border-t border-[#FDFBF7]/10 text-[11px] text-[#FDFBF7]/70">
                                <strong className="text-[#FDFBF7] block">
                                  Items ({formatINR(booking.cartTotal)}):
                                </strong>
                                <span className="line-clamp-2">{booking.itemsSummary}</span>
                              </div>
                            )}

                            {booking.notes && (
                              <div className="pt-2 border-t border-[#FDFBF7]/10 text-[11px] text-[#FDFBF7]/60">
                                <strong className="text-[#FDFBF7] block">Notes:</strong>
                                <p className="line-clamp-2">{booking.notes}</p>
                              </div>
                            )}

                            {/* INTAKE QUESTIONNAIRE ANSWERS (Q1 - Q6) */}
                            <div className="pt-2 border-t border-[#FDFBF7]/15">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedIntakeSlot((cur) => (cur === slotId ? null : slotId))
                                }
                                className="w-full flex items-center justify-between text-left py-1 text-[11px] font-bold text-[#C2D8C4] hover:text-[#FDFBF7] cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3 h-3" />
                                  Intake Answers (Q1–Q6)
                                </span>
                                {isIntakeOpen ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {isIntakeOpen && (
                                <div className="mt-2.5 p-3 border border-[#FDFBF7]/20 bg-[#121214] space-y-3 text-[11px] font-mono leading-relaxed text-[#FDFBF7]/85">
                                  {booking.q1BrandPersonality && (
                                    <div>
                                      <span className="text-[#C2D8C4] font-bold block mb-1">
                                        Q1: Brand Personality
                                      </span>
                                      <p className="text-[#FDFBF7]/90">{booking.q1BrandPersonality}</p>
                                    </div>
                                  )}

                                  {booking.q2FavoriteWebsites && (
                                    <div>
                                      <span className="text-[#C2D8C4] font-bold block mb-1">
                                        Q2: Inspiration Websites
                                      </span>
                                      <p className="text-[#FDFBF7]/90 italic">
                                        &ldquo;{booking.q2FavoriteWebsites}&rdquo;
                                      </p>
                                    </div>
                                  )}

                                  {booking.q3PrimaryGoal && (
                                    <div>
                                      <span className="text-[#C2D8C4] font-bold block mb-1">
                                        Q3: Primary 5-Second Goal
                                      </span>
                                      <p className="text-[#FDFBF7]/90">{booking.q3PrimaryGoal}</p>
                                    </div>
                                  )}

                                  {booking.q4ContentReliance && (
                                    <div>
                                      <span className="text-[#C2D8C4] font-bold block mb-1">
                                        Q4: Content Types
                                      </span>
                                      <p className="text-[#FDFBF7]/90">{booking.q4ContentReliance}</p>
                                    </div>
                                  )}

                                  {booking.q5TargetAudience && (
                                    <div>
                                      <span className="text-[#C2D8C4] font-bold block mb-1">
                                        Q5: Target Customer &amp; Tech Savviness
                                      </span>
                                      <p className="text-[#FDFBF7]/90">{booking.q5TargetAudience}</p>
                                    </div>
                                  )}

                                  {booking.q6VisualAssetsScope && (
                                    <div>
                                      <span className="text-[#C2D8C4] font-bold block mb-1">
                                        Q6: Visual Assets Scope
                                      </span>
                                      <p className="text-[#FDFBF7]/90">{booking.q6VisualAssetsScope}</p>
                                    </div>
                                  )}

                                  {!booking.q1BrandPersonality &&
                                    !booking.q2FavoriteWebsites &&
                                    !booking.q3PrimaryGoal && (
                                      <p className="text-[#FDFBF7]/50 italic">
                                        No intake responses recorded for this entry.
                                      </p>
                                    )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-xs font-mono text-[#FDFBF7]/60">
                            Occupied slot. Sign in with Google ({ADMIN_EMAIL}) above to load client PII details.
                          </div>
                        )}
                      </div>

                      {isAdminUser && (
                        <button
                          type="button"
                          onClick={() => handleAdminDeleteBooking(slotId)}
                          className="w-full inline-flex items-center justify-center gap-2 border border-red-500/50 hover:bg-red-950/40 text-red-300 py-2.5 px-3 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer mt-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear Booking &amp; Free Slot</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        )}
      </div>
    );
  }

  // ==========================================
  // PUBLIC WEBSITE (/)
  // ==========================================
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

        {/* 6. CLIENT BOOKING & INTAKE QUESTIONNAIRE */}
        <section
          id="book"
          className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-b-[0.5px] border-[#121214]/15"
        >
          <div className="max-w-3xl mx-auto bg-[#FDFBF7] border border-[#121214] p-7 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-[#121214]">
                Book Your Build
              </h2>
              <span className="border border-[#121214] bg-[#C2D8C4] px-2.5 py-1 text-xs font-mono font-bold text-[#121214]">
                {occupiedCount} / {MAX_BOOKINGS} Slots Booked
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#3A403C] mb-6">
              We take a maximum of 5 builds at a time. Complete your basic details and the 6-question design intake—we reach out directly within a couple days.
            </p>

            {/* CART SUMMARY */}
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
                    <span>Intake &amp; Booking Confirmed</span>
                  </div>
                  <p className="text-base font-bold text-[#121214] leading-snug">
                    Your project details and questionnaire answers have been logged into our studio pipeline. You will hear from us directly within a couple days.
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
              <div className="space-y-6">
                {/* STEP INDICATOR */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setBookingStep(1)}
                    className={`py-2 px-3 border border-[#121214] text-center font-bold transition-colors cursor-pointer ${
                      bookingStep === 1
                        ? 'bg-[#121214] text-[#FDFBF7]'
                        : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/30'
                    }`}
                  >
                    1. Contact &amp; Budget
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep1()) setBookingStep(2);
                    }}
                    className={`py-2 px-3 border border-[#121214] text-center font-bold transition-colors cursor-pointer ${
                      bookingStep === 2
                        ? 'bg-[#121214] text-[#FDFBF7]'
                        : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/30'
                    }`}
                  >
                    2. Design Questionnaire (Q1–Q6)
                  </button>
                </div>

                {error && (
                  <div className="p-2.5 border border-[#121214] bg-[#C2D8C4]/40 text-xs font-mono text-[#121214]">
                    {error}
                  </div>
                )}

                {/* STEP 1: CONTACT & BUDGET */}
                {bookingStep === 1 && (
                  <form onSubmit={handleProceedToIntake} noValidate className="space-y-4">
                    <div>
                      <label
                        htmlFor="book-budget"
                        className="block text-xs font-bold text-[#121214] mb-1"
                      >
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
                        <label
                          htmlFor="book-phone"
                          className="block text-xs font-bold text-[#121214] mb-1"
                        >
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
                        <label
                          htmlFor="book-email"
                          className="block text-xs font-bold text-[#121214] mb-1"
                        >
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
                      <label
                        htmlFor="book-name"
                        className="block text-xs font-bold text-[#121214] mb-1"
                      >
                        Name / Business
                      </label>
                      <input
                        id="book-name"
                        type="text"
                        maxLength={160}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name or company"
                        className="w-full bg-[#FDFBF7] border border-[#121214] px-3.5 py-2.5 text-sm text-[#121214] rounded-none focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="book-notes"
                        className="block text-xs font-bold text-[#121214] mb-1"
                      >
                        What do you need built? (Summary)
                      </label>
                      <textarea
                        id="book-notes"
                        rows={3}
                        maxLength={1500}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Tell us briefly about your business, products, or service goals..."
                        className="w-full bg-[#FDFBF7] border border-[#121214] p-3 text-sm text-[#121214] rounded-none focus:outline-none font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none py-4 transition-opacity hover:opacity-90 cursor-pointer"
                    >
                      <span>Continue to Design Questionnaire</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {/* STEP 2: INTAKE QUESTIONNAIRE (Q1 - Q6) */}
                {bookingStep === 2 && (
                  <form
                    id="intake-questionnaire"
                    onSubmit={handleBookingSubmit}
                    noValidate
                    className="space-y-8 pt-2"
                  >
                    {/* Q1 */}
                    <div className="space-y-2.5 p-4 border border-[#121214] bg-[#C2D8C4]/15">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121214]">
                          Q1: Brand Personality
                        </span>
                        <span className="text-[11px] font-mono text-[#3A403C]">
                          Selected {q1Selected.length} / 3
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-[#121214]">
                        If your brand walked into a room, how would you describe its personality? (Select up to 3)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {Q1_OPTIONS.map((opt) => {
                          const isSel = q1Selected.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleQ1(opt)}
                              className={`p-2.5 text-left text-xs border border-[#121214] transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-[#121214] text-[#FDFBF7] font-bold'
                                  : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/40'
                              }`}
                            >
                              • {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q2 */}
                    <div className="space-y-2.5 p-4 border border-[#121214] bg-[#C2D8C4]/15">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121214]">
                        Q2: Inspiration Websites
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-[#121214]">
                        Can you share 2–3 websites you love and explain what you like about them?
                      </p>
                      <textarea
                        rows={3}
                        maxLength={1500}
                        value={q2Websites}
                        onChange={(e) => setQ2Websites(e.target.value)}
                        placeholder="e.g., Apple.com because of its smooth product animations, or Stripe.com because of its clean layout."
                        className="w-full bg-[#FDFBF7] border border-[#121214] p-3 text-xs sm:text-sm text-[#121214] rounded-none focus:outline-none font-mono"
                      />
                    </div>

                    {/* Q3 */}
                    <div className="space-y-2.5 p-4 border border-[#121214] bg-[#C2D8C4]/15">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121214]">
                        Q3: Primary 5-Second Goal
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-[#121214]">
                        What is the number one action you want a visitor to take within 5 seconds of landing on your site? (Select one)
                      </p>
                      <div className="space-y-2 pt-1">
                        {Q3_OPTIONS.map((opt) => {
                          const isSel = q3Goal === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setQ3Goal(opt)}
                              className={`w-full p-2.5 text-left text-xs border border-[#121214] transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-[#121214] text-[#FDFBF7] font-bold'
                                  : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/40'
                              }`}
                            >
                              ({isSel ? '●' : ' '}) {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q4 */}
                    <div className="space-y-2.5 p-4 border border-[#121214] bg-[#C2D8C4]/15">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121214]">
                        Q4: Content Structure
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-[#121214]">
                        How heavily does your business rely on content, and what type is it? (Select all that apply)
                      </p>
                      <div className="space-y-2 pt-1">
                        {Q4_OPTIONS.map((opt) => {
                          const isSel = q4Content.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleQ4(opt)}
                              className={`w-full p-2.5 text-left text-xs border border-[#121214] transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-[#121214] text-[#FDFBF7] font-bold'
                                  : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/40'
                              }`}
                            >
                              [{isSel ? '✓' : ' '}] {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q5 */}
                    <div className="space-y-2.5 p-4 border border-[#121214] bg-[#C2D8C4]/15">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121214]">
                        Q5: Target Customer &amp; Tech Savviness
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-[#121214]">
                        Who is your primary target customer, and how tech-savvy are they? (Select one)
                      </p>
                      <div className="space-y-2 pt-1">
                        {Q5_OPTIONS.map((opt) => {
                          const isSel = q5Audience === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setQ5Audience(opt)}
                              className={`w-full p-2.5 text-left text-xs border border-[#121214] transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-[#121214] text-[#FDFBF7] font-bold'
                                  : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/40'
                              }`}
                            >
                              ({isSel ? '●' : ' '}) {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q6 */}
                    <div className="space-y-2.5 p-4 border border-[#121214] bg-[#C2D8C4]/15">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121214]">
                        Q6: Visual Assets Readiness
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-[#121214]">
                        What is the scope of your visual assets ready for day one? (Select one)
                      </p>
                      <div className="space-y-2 pt-1">
                        {Q6_OPTIONS.map((opt) => {
                          const isSel = q6Assets === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setQ6Assets(opt)}
                              className={`w-full p-2.5 text-left text-xs border border-[#121214] transition-colors cursor-pointer ${
                                isSel
                                  ? 'bg-[#121214] text-[#FDFBF7] font-bold'
                                  : 'bg-[#FDFBF7] text-[#121214] hover:bg-[#C2D8C4]/40'
                              }`}
                            >
                              ({isSel ? '●' : ' '}) {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBookingStep(1)}
                        className="w-full sm:w-auto border border-[#121214] bg-[#FDFBF7] text-[#121214] font-black uppercase text-xs tracking-widest rounded-none py-4 px-6 hover:bg-[#C2D8C4]/40 cursor-pointer"
                      >
                        ← Back to Details
                      </button>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 w-full bg-[#121214] text-[#FDFBF7] font-black uppercase text-xs tracking-widest rounded-none py-4 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        {submitting ? 'Submitting & Booking...' : 'Submit Questionnaire & Book Slot'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t-[0.5px] border-[#121214]/15">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#3A403C]">
          <div className="flex items-center gap-4">
            <span className="font-black text-[#121214]">KANNVVAS</span>
            <span>Enterprise Software Studio</span>
          </div>

          <div className="flex items-center gap-5">
            <a
              href={CREDENTIALS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-[#121214] hover:underline"
            >
              <span>Our credentials</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => navigateTo('/admin')}
              className="text-[#3A403C] hover:text-[#121214] hover:underline cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              <span>Admin Console</span>
            </button>
          </div>
        </div>
      </footer>

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
