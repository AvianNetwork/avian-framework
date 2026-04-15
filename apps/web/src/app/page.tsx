import { CheckCircle2, ClipboardList, Handshake, Target, PenLine, Link2, Shuffle, Link } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-16 space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-avian-400">Non-custodial</span> asset marketplace
          <br />on the Avian blockchain
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Buy and sell AVN assets using PSBT — your keys never leave your wallet.
          The app coordinates, you sign.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="/marketplace" className="btn-primary text-base px-6 py-3">
            Browse Marketplace
          </a>
          <a href="/assets" className="btn-secondary text-base px-6 py-3">
            Explore Assets
          </a>
        </div>
      </section>

      {/* Workflows */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-center">Three ways to trade</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {WORKFLOWS.map((w) => (
            <div key={w.title} className="card space-y-3 flex flex-col">
              <div className="text-avian-400">{w.icon}</div>
              <h3 className="font-semibold text-lg">{w.title}</h3>
              <p className="text-gray-400 text-sm flex-1">{w.description}</p>
              <a href={w.href} className="btn-secondary text-xs py-1.5 text-center mt-auto">
                {w.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* How a sale settles */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-center">How settlement works</h2>
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-0 items-stretch">
          {STEPS.flatMap((step, i) => {
            const card = (
              <div key={step.title} className="card space-y-2 text-center">
                <div className="flex justify-center text-avian-400">{step.icon}</div>
                <h3 className="font-semibold text-sm">{step.title}</h3>
                <p className="text-gray-400 text-xs">{step.description}</p>
              </div>
            );
            if (i < STEPS.length - 1) {
              return [card, (
                <div key={`arrow-${i}`} className="flex items-center justify-center w-8">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-gray-500" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )];
            }
            return [card];
          })}
        </div>
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {STEPS.map((step) => (
            <div key={step.title} className="card space-y-2 text-center">
              <div className="flex justify-center text-avian-400">{step.icon}</div>
              <h3 className="font-semibold text-sm">{step.title}</h3>
              <p className="text-gray-400 text-xs">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature callouts */}
      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Why PSBT?</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-300 text-sm">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-avian-400 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const WORKFLOWS = [
  {
    icon: <ClipboardList className="w-10 h-10" />,
    title: 'List & Sell',
    description:
      'Create a listing at your asking price. Sign a PSBT with SINGLE|FORKID|ANYONECANPAY so buyers can atomically purchase without you being online.',
    href: '/marketplace',
    cta: 'Browse listings →',
  },
  {
    icon: <Handshake className="w-10 h-10" />,
    title: 'Make an Offer',
    description:
      'See a listing you like? Submit an offer below the asking price. The seller reviews and accepts — then you complete the purchase.',
    href: '/marketplace',
    cta: 'Find listings →',
  },
  {
    icon: <Target className="w-10 h-10" />,
    title: 'Blind Offer',
    description:
      'Want an asset that isn\'t listed? Submit a blind offer with your price. The asset holder is notified and can accept by providing a signed PSBT.',
    href: '/assets',
    cta: 'Explore assets →',
  },
];

const STEPS = [
  {
    icon: <PenLine className="w-8 h-8" />,
    title: 'Seller signs PSBT',
    description: 'Signs with SINGLE|FORKID|ANYONECANPAY — commits to their asset input and payment output only.',
  },
  {
    icon: <Link2 className="w-8 h-8" />,
    title: 'Buyer builds funding PSBT',
    description: 'Adds their own AVN inputs, seeding the seller\'s UTXO at input[0] to preserve the signature.',
  },
  {
    icon: <Shuffle className="w-8 h-8" />,
    title: 'App injects & combines',
    description: 'The seller\'s partial signature is injected into the buyer\'s transaction at the binary BIP174 level.',
  },
  {
    icon: <Link className="w-8 h-8" />,
    title: 'Finalized & broadcast',
    description: 'Buyer signs their inputs, the PSBT is finalized, and both sides settle atomically on-chain.',
  },
];

const FEATURES = [
  'Non-custodial — the app never holds your private keys',
  'Atomic swaps — asset and payment settle in the same transaction',
  'Transparent — review exactly what you are signing before confirming',
  'Blind offers — bid on any asset, even without an active listing',
  'Open standard — works with CLI tools, desktop apps, and mobile',
  'Avian Core 5.0 compatible — uses the full PSBT RPC suite',
];
