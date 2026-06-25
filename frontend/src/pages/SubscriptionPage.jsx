import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Check, Star, ArrowLeft, Clock, Zap, Shield, Globe, Bell, BarChart2, Settings, Users } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const PRICING = {
  standard: { monthly: 49,  yearly: 39  },
  pro:      { monthly: 149, yearly: 119 },
};

const STANDARD_FEATURES = [
  { text: 'Risk Intelligence Dashboard', icon: BarChart2 },
  { text: 'Disruption Alerts',           icon: Bell },
  { text: 'AI Pipeline (5 Agents)',      icon: Zap },
  { text: 'Import Compliance Checker',   icon: Shield },
  { text: 'Historical Impact Analysis',  icon: Clock },
  { text: 'Email Alert Notifications',   icon: Bell },
  { text: 'Disruption Event Globe',      icon: Globe },
  { text: 'Settings & Team Profile',     icon: Settings },
];

const PRO_EXTRA_FEATURES = [
  { text: 'Global Supplier Panel',       icon: Globe,   highlight: true },
  { text: 'Alternative Supplier Finder', icon: Users,   highlight: true },
  { text: 'Supplier Reliability Scores', icon: Star,    highlight: true },
  { text: 'Priority Support',            icon: Shield,  highlight: false },
];

export default function SubscriptionPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [subscription, setSubscription]   = useState(null);
  const [billing, setBilling]             = useState('monthly');
  const [countdown, setCountdown]         = useState('');
  const [loading, setLoading]             = useState(false);
  const [paymentMsg, setPaymentMsg]       = useState('');
  const [confirming, setConfirming]       = useState(false);

  const upgradeIntent = searchParams.get('upgrade') === 'pro';
  const paymentStatus = searchParams.get('payment');
  const sessionId     = searchParams.get('session_id');
  const planIdParam   = searchParams.get('plan');

  // ── Fetch subscription status ─────────────────────────────────────────────
  const fetchSub = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v2/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch (e) {
      console.error('Could not load subscription:', e);
    }
  };

  useEffect(() => { fetchSub(); }, []);

  // ── Confirm Stripe payment when redirected back ───────────────────────────
  useEffect(() => {
    if (paymentStatus === 'success' && sessionId && planIdParam && !confirming) {
      setConfirming(true);
      (async () => {
        const token = await getToken();
        try {
          const res = await fetch(`${API_URL}/api/v2/payment/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ session_id: sessionId, plan_id: planIdParam }),
          });
          if (res.ok) {
            const data = await res.json();
            setSubscription(data.subscription);
            setPaymentMsg('Payment successful! Your subscription is now active.');
          } else {
            setPaymentMsg('Payment received but activation failed — please contact support.');
          }
        } catch {
          setPaymentMsg('Could not verify payment. Please refresh.');
        } finally {
          setConfirming(false);
        }
      })();
    } else if (paymentStatus === 'cancelled') {
      setPaymentMsg('Payment cancelled. You can try again below.');
    }
  }, [paymentStatus, sessionId, planIdParam]);

  // ── Trial countdown ────────────────────────────────────────────────────────
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

  const isOnTrial  = subscription?.status === 'trial';
  const isExpired  = subscription?.status === 'expired';
  const isActive   = subscription?.status === 'active';
  const currentPlan = subscription?.plan;
  const hoursLeft  = subscription?.hours_left ? Math.ceil(subscription.hours_left) : 0;

  // ── Handle plan selection → Stripe Checkout ───────────────────────────────
  const handleChoosePlan = async (planId) => {
    const fullPlanId = `${planId}-${billing}`;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v2/payment/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: fullPlanId }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to create checkout');
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;   // redirect to Stripe hosted checkout
    } catch (err) {
      setPaymentMsg(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const price = (planId) => `$${PRICING[planId]?.[billing] ?? ''}`;
  const yearlySaving = Math.round((PRICING.pro.monthly - PRICING.pro.yearly) * 12);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #07080f 0%, #0b111e 50%, #07080f 100%)',
      fontFamily: 'Inter, sans-serif',
      paddingLeft: 'var(--sidebar-w, 224px)',
    }}>
      {/* Ambient glows */}
      <div style={{ position:'fixed', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', top:'-200px', right:'-100px', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)', bottom:'-150px', left:'300px', pointerEvents:'none', zIndex:0 }} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '44px 32px 80px', position: 'relative', zIndex: 10 }}>

        {/* Back */}
        <button onClick={() => navigate('/dashboard')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:13, marginBottom:36, padding:0, fontFamily:'Inter, sans-serif', display:'flex', alignItems:'center', gap:6 }}
          onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.3)'}
        >
          <ArrowLeft size={14}/> Back to Dashboard
        </button>

        {/* Payment result banner */}
        {paymentMsg && (
          <div style={{ background: paymentMsg.startsWith('Payment successful') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${paymentMsg.startsWith('Payment successful') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius:10, padding:'14px 20px', marginBottom:28, color: paymentMsg.startsWith('Payment successful') ? '#6ee7b7' : '#fca5a5', fontSize:13, fontWeight:600 }}>
            {paymentMsg}
          </div>
        )}

        {/* Upgrade intent notice */}
        {upgradeIntent && (
          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'14px 20px', marginBottom:32, display:'flex', alignItems:'center', gap:12 }}>
            <Zap size={18} color="#f59e0b"/>
            <div>
              <p style={{ margin:0, fontWeight:700, color:'#FDE68A', fontSize:13 }}>Pro Plan required</p>
              <p style={{ margin:0, color:'rgba(255,255,255,0.45)', fontSize:12 }}>Upgrade below to unlock the Global Supplier Panel and all Pro features.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:44 }}>
          {/* Status badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:18, padding:'6px 16px', background: isActive ? 'rgba(16,185,129,0.1)' : isOnTrial ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', border:`1px solid ${isActive ? 'rgba(16,185,129,0.25)' : isOnTrial ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius:100 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background: isActive ? '#10b981' : isOnTrial ? '#f59e0b' : '#ef4444', display:'inline-block' }}/>
            <span style={{ fontSize:12, fontWeight:600, color: isActive ? '#6ee7b7' : isOnTrial ? '#FDE68A' : '#fca5a5' }}>
              {subscription === null ? 'Loading...' : isActive ? `Active: ${(currentPlan||'').toUpperCase()} Plan` : isOnTrial ? `Free trial — ${hoursLeft}h remaining` : 'Trial ended — subscribe to continue'}
            </span>
          </div>

          {/* Trial live countdown */}
          {isOnTrial && countdown && (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:40, fontWeight:800, color:'#F59E0B', letterSpacing:'0.06em', lineHeight:1 }}>{countdown}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:5, letterSpacing:'0.1em', textTransform:'uppercase' }}>trial time remaining</div>
            </div>
          )}

          <h1 style={{ fontSize:32, fontWeight:800, color:'white', margin:'0 0 10px', letterSpacing:'-0.5px' }}>
            {isActive ? 'Manage Subscription' : 'Choose Your Plan'}
          </h1>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, margin:'0 auto', maxWidth:520 }}>
            {isOnTrial
              ? 'You have full access during your 24-hour trial. Subscribe now — your plan starts when the trial ends.'
              : isExpired
              ? 'Your trial has ended. Pick a plan to restore access.'
              : isActive
              ? 'Manage or upgrade your subscription below.'
              : 'Get started with a plan that fits your business.'}
          </p>
        </div>

        {/* Billing toggle */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:40, alignItems:'center', gap:14 }}>
          {['monthly','yearly'].map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{
              background: billing===b ? 'rgba(245,158,11,0.15)' : 'transparent',
              border: billing===b ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: billing===b ? '#F59E0B' : 'rgba(255,255,255,0.35)',
              padding:'8px 20px', borderRadius:8, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'Inter, sans-serif', transition:'all 0.2s',
              display:'flex', alignItems:'center', gap:8,
            }}>
              {b.charAt(0).toUpperCase()+b.slice(1)}
              {b === 'yearly' && (
                <span style={{ background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:100 }}>
                  SAVE ${yearlySaving}/yr
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:56 }}>
          {[
            { id:'standard', name:'Standard', tagline:'Full platform access for importers', color:'#3B82F6', gradient:'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
            { id:'pro',      name:'Pro',      tagline:'Standard + Global Supplier Panel',  color:'#F59E0B', gradient:'linear-gradient(135deg,#d97706,#f59e0b)', badge:'Most Popular' },
          ].map((plan) => {
            const isCurrent = isActive && currentPlan === plan.id;
            const isPro = plan.id === 'pro';

            return (
              <div key={plan.id} style={{
                background: isPro ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                border: isPro ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius:16, padding:'32px 28px', position:'relative',
                transition:'box-shadow 0.2s, border-color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = plan.color + '55'}
                onMouseLeave={e => e.currentTarget.style.borderColor = isPro ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.07)'}
              >
                {plan.badge && !isCurrent && (
                  <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:plan.gradient, color:'#0a0f1e', fontSize:10, fontWeight:800, padding:'3px 14px', borderRadius:100, whiteSpace:'nowrap', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                    {plan.badge}
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#10b981,#059669)', color:'white', fontSize:10, fontWeight:800, padding:'3px 14px', borderRadius:100, whiteSpace:'nowrap', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                    Your Current Plan
                  </div>
                )}

                {/* Plan label */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ display:'inline-block', background:plan.gradient, borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:700, color:'#0a0f1e', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {plan.name}
                  </div>
                  <p style={{ margin:'0 0 12px', color:'rgba(255,255,255,0.38)', fontSize:12 }}>{plan.tagline}</p>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                    <span style={{ fontSize:44, fontWeight:800, color:'white', lineHeight:1 }}>{price(plan.id)}</span>
                    <span style={{ color:'rgba(255,255,255,0.3)', fontSize:13 }}>/mo{billing==='yearly' ? ' billed yearly' : ''}</span>
                  </div>
                  {billing==='yearly' && (
                    <p style={{ margin:'4px 0 0', color:'#10b981', fontSize:11, fontWeight:600 }}>
                      Save ${(PRICING[plan.id].monthly - PRICING[plan.id].yearly) * 12}/year vs monthly
                    </p>
                  )}
                </div>

                {/* Standard features */}
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  {STANDARD_FEATURES.map((f, i) => (
                    <li key={i} style={{ fontSize:12.5, color:'rgba(255,255,255,0.72)', display:'flex', alignItems:'center', gap:9, lineHeight:1.4 }}>
                      <Check size={13} color={plan.color} strokeWidth={2.5} style={{ flexShrink:0 }}/>
                      {f.text}
                    </li>
                  ))}
                </ul>

                {/* Pro extras */}
                {isPro && (
                  <>
                    <div style={{ height:1, background:'rgba(245,158,11,0.15)', margin:'12px 0 14px' }}/>
                    <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:700, color:'#F59E0B', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                      + Pro Exclusive
                    </p>
                    <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', display:'flex', flexDirection:'column', gap:8 }}>
                      {PRO_EXTRA_FEATURES.map((f, i) => (
                        <li key={i} style={{ fontSize:12.5, display:'flex', alignItems:'center', gap:9, lineHeight:1.4, color: f.highlight ? '#FDE68A' : 'rgba(255,255,255,0.65)' }}>
                          <Star size={13} color="#F59E0B" strokeWidth={2.5} style={{ flexShrink:0 }}/>
                          {f.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* CTA */}
                <button
                  disabled={isCurrent || loading}
                  onClick={() => !isCurrent && handleChoosePlan(plan.id)}
                  style={{
                    width:'100%', padding:'13px',
                    background: isCurrent ? 'rgba(16,185,129,0.12)' : isPro ? plan.gradient : 'rgba(59,130,246,0.15)',
                    border: isCurrent ? '1px solid rgba(16,185,129,0.3)' : !isPro ? '1px solid rgba(59,130,246,0.4)' : 'none',
                    borderRadius:8, color: isCurrent ? '#6ee7b7' : isPro ? '#0a0f1e' : '#93C5FD',
                    fontSize:13, fontWeight:700, cursor: isCurrent ? 'default' : 'pointer',
                    fontFamily:'Inter, sans-serif', transition:'opacity 0.2s',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!isCurrent && !loading) e.currentTarget.style.opacity='0.85'; }}
                  onMouseLeave={e => { if (!isCurrent && !loading) e.currentTarget.style.opacity='1'; }}
                >
                  {isCurrent ? 'Current Plan' : loading ? 'Redirecting...' : `Get ${plan.name} — ${price(plan.id)}/mo`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden', marginBottom:40 }}>
          <div style={{ padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'grid', gridTemplateColumns:'1fr 130px 130px', gap:16, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Feature</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#3B82F6', letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center' }}>Standard</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#F59E0B', letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center' }}>Pro</span>
          </div>
          {[
            ...STANDARD_FEATURES.map(f => ({ text:f.text, standard:true, pro:true })),
            ...PRO_EXTRA_FEATURES.map(f => ({ text:f.text, standard:false, pro:true, highlight:f.highlight })),
          ].map((row, i) => (
            <div key={i} style={{ padding:'10px 24px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'grid', gridTemplateColumns:'1fr 130px 130px', gap:16, alignItems:'center', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
              <span style={{ fontSize:13, color: row.highlight ? '#FDE68A' : 'rgba(255,255,255,0.65)' }}>{row.text}</span>
              <span style={{ textAlign:'center' }}>
                {row.standard ? <Check size={15} color="#3B82F6" strokeWidth={2.5}/> : <span style={{ color:'rgba(255,255,255,0.15)', fontSize:18 }}>—</span>}
              </span>
              <span style={{ textAlign:'center' }}>
                <Check size={15} color="#F59E0B" strokeWidth={2.5}/>
              </span>
            </div>
          ))}
        </div>

        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:11 }}>
          Payments are processed securely by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
