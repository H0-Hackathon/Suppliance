import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ── Pricing data ──────────────────────────────────────────────────────────────
const PRICING = {
  standard: { monthly: 49, yearly: 39 },
  pro:      { monthly: 149, yearly: 119 },
};

const STANDARD_FEATURES = [
  { text: 'Risk Intelligence Dashboard', tip: 'Live tariff risk scores & geopolitical alerts' },
  { text: 'Disruption Alerts', tip: 'AI-powered alerts for tariff changes, port closures, sanctions' },
  { text: 'AI Pipeline (5 Agents)', tip: 'Tariff Monitor → Impact Calculator → Compliance → Alternatives → Adversarial' },
  { text: 'Import Compliance Checker', tip: 'Automated HS code & trade-law compliance checks' },
  { text: 'Historical Impact Analysis', tip: '12-month lookback on disruption costs and patterns' },
  { text: 'Email Alert Notifications', tip: 'Instant email when a new risk is detected' },
  { text: 'Disruption Event Globe', tip: 'Interactive global risk map' },
  { text: 'Settings & Team Profile', tip: '' },
];

const PRO_EXTRA_FEATURES = [
  { text: 'Global Supplier Panel', tip: '25,000+ vetted exporters — filter by country, category & rating', highlight: true },
  { text: 'Alternative Supplier Finder', tip: 'AI suggests pre-vetted alternative suppliers per alert', highlight: true },
  { text: 'Supplier Reliability Scores', tip: 'Real-time ratings and lead-time data', highlight: true },
  { text: 'Priority Support', tip: 'Dedicated account manager & < 4h response time', highlight: false },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SubscriptionPage() {
  const { user } = useUser();
  const { getToken, signOut } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const upgradeIntent = searchParams.get('upgrade') === 'pro';

  useEffect(() => {
    let isMounted = true;
    const fetchSub = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/v2/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setSubscription(data.subscription);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSub();
    return () => { isMounted = false; };
  }, [getToken]);

  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'yearly'
  const [selected, setSelected] = useState(null);
  const [countdown, setCountdown] = useState('');

  const isOnTrial = subscription?.status === 'trial';
  const isExpired = subscription?.status === 'expired';
  const isActive  = subscription?.status === 'active';
  const currentPlan = subscription?.plan; // 'starter' | 'pro' | null

  const hoursLeft = subscription?.hours_left ? Math.ceil(subscription.hours_left) : 0;
  const yearlySaving = Math.round(((PRICING.pro.monthly - PRICING.pro.yearly) * 12));

  // Live countdown during trial
  useEffect(() => {
    if (!subscription?.expires_at) return;
    const tick = () => {
      const diff = Math.max(0, new Date(subscription.expires_at).getTime() - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [subscription?.expires_at]);

  const handleChoosePlan = (planId) => {
    // Calculate display amount
    const amount = PRICING[planId][billing];
    const totalAmount = billing === 'yearly' ? amount * 12 : amount;

    // Redirect to the dedicated payment page
    navigate('/payment', { state: { planId, billing, amount: totalAmount } });
  };

  const price = (planId) => {
    const p = PRICING[planId]?.[billing];
    return p ? `$${p}` : '';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #07080f 0%, #0b111e 50%, #07080f 100%)',
      fontFamily: 'Inter, sans-serif',
      paddingLeft: 'var(--sidebar-w, 224px)',
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{ position:'fixed', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', top:'-200px', right:'-100px', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)', bottom:'-150px', left:'300px', pointerEvents:'none', zIndex:0 }} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '44px 32px 80px', position: 'relative', zIndex: 10 }}>

        {/* ── Back ── */}
        <button onClick={() => navigate('/dashboard')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:13, marginBottom:36, padding:0, fontFamily:'Inter, sans-serif', display:'flex', alignItems:'center', gap:6, transition:'color 0.2s' }} onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
          ← Back to Dashboard
        </button>

        {/* ── Pro-upgrade notice ── */}
        {upgradeIntent && (
          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'14px 20px', marginBottom:32, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>🔒</span>
            <div>
              <p style={{ margin:0, fontWeight:700, color:'#FDE68A', fontSize:13 }}>Pro Plan required</p>
              <p style={{ margin:0, color:'rgba(255,255,255,0.45)', fontSize:12 }}>The feature you tried to access is exclusive to Pro subscribers. Upgrade below to unlock access.</p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:18, padding:'6px 16px', background: isActive ? 'rgba(16,185,129,0.1)' : isOnTrial ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${isActive ? 'rgba(16,185,129,0.25)' : isOnTrial ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius:100 }}>
            <span style={{ fontSize:13 }}>{isActive ? '✅' : isOnTrial ? '⏱' : '⏰'}</span>
            <span style={{ fontSize:12, fontWeight:600, color: isActive ? '#6ee7b7' : isOnTrial ? '#FDE68A' : '#fca5a5' }}>
              {isActive ? `Active: ${(currentPlan||'').toUpperCase()} Plan` : isOnTrial ? `Free trial — ${hoursLeft}h remaining` : 'Your free trial has ended'}
            </span>
          </div>

          {/* Trial countdown */}
          {isOnTrial && countdown && (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:38, fontWeight:800, color:'#F59E0B', letterSpacing:'0.06em', lineHeight:1 }}>{countdown}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:5, letterSpacing:'0.1em', textTransform:'uppercase' }}>trial time remaining</div>
            </div>
          )}

          <h1 style={{ fontSize:32, fontWeight:800, color:'white', margin:'0 0 10px', letterSpacing:'-0.5px' }}>
            {isActive ? 'Manage Subscription' : 'Upgrade CoastGuard'}
          </h1>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:'0 auto', maxWidth:500 }}>
            {isOnTrial
              ? 'You have full access during your trial. Subscribe now and your plan starts automatically when the trial ends — no interruption.'
              : isExpired
              ? 'Your trial has ended. Choose a plan below to restore access.'
              : 'Manage or upgrade your plan anytime.'}
          </p>
        </div>

        {/* ── Billing toggle ── */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:40, alignItems:'center', gap:14 }}>
          <button onClick={() => setBilling('monthly')} style={{ background: billing==='monthly' ? 'rgba(245,158,11,0.15)' : 'transparent', border: billing==='monthly' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)', color: billing==='monthly' ? '#F59E0B' : 'rgba(255,255,255,0.35)', padding:'8px 20px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', transition:'all 0.2s' }}>
            Monthly
          </button>
          <button onClick={() => setBilling('yearly')} style={{ background: billing==='yearly' ? 'rgba(245,158,11,0.15)' : 'transparent', border: billing==='yearly' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)', color: billing==='yearly' ? '#F59E0B' : 'rgba(255,255,255,0.35)', padding:'8px 20px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', transition:'all 0.2s', display:'flex', alignItems:'center', gap:8 }}>
            Yearly
            <span style={{ background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:100, letterSpacing:'0.05em' }}>
              SAVE ${yearlySaving}/yr
            </span>
          </button>
        </div>

        {/* ── Plan cards ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:56 }}>

          {/* ── STANDARD ── */}
          {[
            { id:'standard', name:'Standard', tagline:'Full platform access for importers', color:'#3B82F6', gradient:'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
            { id:'pro',      name:'Pro',      tagline:'Standard + Global Supplier Panel', color:'#F59E0B', gradient:'linear-gradient(135deg,#d97706,#f59e0b)', badge:'Most Popular' },
          ].map((plan) => {
            const isCurrent = isActive && currentPlan === plan.id;
            const isChosen  = selected === plan.id;
            const isPro     = plan.id === 'pro';

            return (
              <div key={plan.id} style={{ background: isPro ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)', border: isChosen ? `2px solid ${plan.color}` : isPro ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'32px 28px', position:'relative', transition:'box-shadow 0.2s', boxShadow: isChosen ? `0 0 32px ${plan.color}20` : 'none' }}>

                {plan.badge && !isCurrent && (
                  <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:plan.gradient, color:'#0a0f1e', fontSize:10, fontWeight:800, padding:'3px 14px', borderRadius:100, whiteSpace:'nowrap', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                    {plan.badge}
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontSize:10, fontWeight:800, padding:'3px 14px', borderRadius:100, whiteSpace:'nowrap', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                    ✓ Your Current Plan
                  </div>
                )}

                {/* Plan name */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ display:'inline-block', background:plan.gradient, borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, color:'#0a0f1e', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {plan.name}
                  </div>
                  <p style={{ margin:'0 0 12px', color:'rgba(255,255,255,0.38)', fontSize:12 }}>{plan.tagline}</p>

                  {/* Price */}
                  <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                    <span style={{ fontSize:42, fontWeight:800, color:'white', lineHeight:1 }}>{price(plan.id)}</span>
                    <span style={{ color:'rgba(255,255,255,0.3)', fontSize:13 }}>/mo{billing==='yearly' ? ' billed yearly' : ''}</span>
                  </div>
                  {billing==='yearly' && (
                    <p style={{ margin:'4px 0 0', color:'#10b981', fontSize:11, fontWeight:600 }}>
                      Save ${(PRICING[plan.id].monthly - PRICING[plan.id].yearly) * 12}/year vs monthly
                    </p>
                  )}
                </div>

                {/* Standard features (all plans) */}
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  {STANDARD_FEATURES.map((f, i) => (
                    <li key={i} style={{ fontSize:12.5, color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'flex-start', gap:8, lineHeight:1.4 }}>
                      <span style={{ color:plan.color, fontWeight:700, flexShrink:0, marginTop:1 }}>✓</span>
                      {f.text}
                    </li>
                  ))}
                </ul>

                {/* Pro extras */}
                {isPro && (
                  <>
                    <div style={{ height:1, background:'rgba(245,158,11,0.15)', margin:'12px 0 14px' }} />
                    <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:700, color:'#F59E0B', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                      + Pro Exclusive
                    </p>
                    <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', display:'flex', flexDirection:'column', gap:8 }}>
                      {PRO_EXTRA_FEATURES.map((f, i) => (
                        <li key={i} style={{ fontSize:12.5, display:'flex', alignItems:'flex-start', gap:8, lineHeight:1.4, color: f.highlight ? '#FDE68A' : 'rgba(255,255,255,0.65)' }}>
                          <span style={{ color:'#F59E0B', fontWeight:700, flexShrink:0, marginTop:1 }}>★</span>
                          {f.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* CTA */}
                <button
                  onClick={() => !isCurrent && handleChoosePlan(plan.id)}
                  style={{ width:'100%', padding:'13px', background: isCurrent ? 'rgba(16,185,129,0.12)' : isPro ? plan.gradient : 'rgba(59,130,246,0.12)', border: isCurrent ? '1px solid rgba(16,185,129,0.3)' : !isPro ? '1px solid rgba(59,130,246,0.3)' : 'none', borderRadius:8, color: isCurrent ? '#6ee7b7' : isPro ? '#0a0f1e' : '#93C5FD', fontSize:13, fontWeight:700, cursor: isCurrent ? 'default' : 'pointer', fontFamily:'Inter, sans-serif', transition:'opacity 0.2s' }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.opacity = '1'; }}
                >
                  {isCurrent
                    ? '✓ Current Plan'
                    : `Get ${plan.name} Now`}
                </button>
              </div>
            );
          })}
        </div>
        


        {/* ── Feature comparison table ── */}
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden', marginBottom:56 }}>
          <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'grid', gridTemplateColumns:'1fr 140px 140px', gap:16, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Feature</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#3B82F6', letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center' }}>Standard</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#F59E0B', letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center' }}>Pro</span>
          </div>
          {[
            ...STANDARD_FEATURES.map(f => ({ text:f.text, standard:true, pro:true })),
            ...PRO_EXTRA_FEATURES.map(f => ({ text:f.text, standard:false, pro:true, highlight:f.highlight })),
          ].map((row, i) => (
            <div key={i} style={{ padding:'11px 24px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'grid', gridTemplateColumns:'1fr 140px 140px', gap:16, alignItems:'center', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
              <span style={{ fontSize:13, color: row.highlight ? '#FDE68A' : 'rgba(255,255,255,0.65)' }}>{row.text}</span>
              <span style={{ textAlign:'center', fontSize:14 }}>{row.standard ? '✓' : <span style={{ color:'rgba(255,255,255,0.15)' }}>—</span>}</span>
              <span style={{ textAlign:'center', fontSize:14, color: row.pro ? '#F59E0B' : 'rgba(255,255,255,0.15)' }}>✓</span>
            </div>
          ))}
        </div>

        {/* ── Sign out ── */}
        <div style={{ textAlign:'center' }}>
          <button onClick={() => logout()} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.18)', fontSize:12, cursor:'pointer', textDecoration:'underline', fontFamily:'Inter, sans-serif' }}>
            Sign out
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
