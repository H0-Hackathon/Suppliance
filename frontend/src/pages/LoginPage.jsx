import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ── UI Components ────────────────────────────────────────────────────────────

const inputStyle = (focused) => ({
  width: '100%',
  padding: '12px 14px',
  background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
  border: `1px solid ${focused ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'all 0.2s ease',
  fontFamily: 'Inter, sans-serif',
});

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '6px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

function InputField({ label, type = 'text', value, onChange, placeholder, required, max }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        max={max}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(focused)}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={onChange}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle(focused),
          appearance: 'none',
          color: value ? 'white' : 'rgba(255,255,255,0.3)',
        }}
      >
        <option value="" disabled>Select an option</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ color: 'black' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' | 'signup'
  const [mode, setMode] = useState('login');

  // Signup Wizard Step: 1 (Account), 2 (OTP), 3 (Company)
  const [step, setStep] = useState(1);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [otp, setOtp] = useState('');
  
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [years, setYears] = useState('');
  const [revenue, setRevenue] = useState('');

  // ── Redirect if already authed ──
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // ── Handlers ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed.');
      login(data.access_token, data.user, data.subscription);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep1 = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/auth/signup/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Account initialization failed.');
      
      // Move to OTP step
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/auth/signup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP verification failed.');
      
      // Move to Company Profile step
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep3 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v2/auth/signup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          company_name: companyName,
          industry,
          location,
          years_in_business: parseInt(years, 10),
          average_revenue: revenue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Finalization failed.');
      
      login(data.access_token, data.user, data.subscription);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  // ── Render ──
  return (
    <div style={{
      minHeight: '100vh',
      background: '#040710',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Abstract Backgrounds */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 800, height: 800, background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 60%)', top: '-300px', left: '-200px', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 600, height: 600, background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 60%)', bottom: '-200px', right: '-100px', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: '100%', height: '100%', background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
      </div>

      <div style={{ width: '100%', maxWidth: mode === 'signup' && step === 3 ? '520px' : '440px', position: 'relative', zIndex: 10, padding: '20px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: 42, height: 42, borderRadius: '10px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
            }}>⚓</div>
            <span style={{ fontSize: '24px', fontWeight: '800', color: 'white', letterSpacing: '-0.5px' }}>
              Coast<span style={{ color: '#F59E0B' }}>Guard</span>
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0, letterSpacing: '0.02em' }}>
            Enterprise Trade Risk Intelligence
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}>
          
          {/* Top Nav (only if Step 1 or Login) */}
          {(mode === 'login' || (mode === 'signup' && step === 1)) && (
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1, padding: '16px', background: mode === 'login' ? 'rgba(245,158,11,0.06)' : 'transparent',
                  border: 'none', borderBottom: mode === 'login' ? '2px solid #F59E0B' : '2px solid transparent',
                  color: mode === 'login' ? '#F59E0B' : 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '700',
                  cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.2s',
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setStep(1); setError(''); }}
                style={{
                  flex: 1, padding: '16px', background: mode === 'signup' ? 'rgba(245,158,11,0.06)' : 'transparent',
                  border: 'none', borderBottom: mode === 'signup' ? '2px solid #F59E0B' : '2px solid transparent',
                  color: mode === 'signup' ? '#F59E0B' : 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '700',
                  cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.2s',
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Stepper Header for Signup Steps > 1 */}
          {mode === 'signup' && step > 1 && (
            <div style={{ padding: '24px 32px 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>✓</div>
                <div style={{ height: 2, width: 30, background: 'rgba(16,185,129,0.2)' }} />
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= 2 ? (step > 2 ? 'rgba(16,185,129,0.2)' : '#F59E0B') : 'rgba(255,255,255,0.1)', color: step > 2 ? '#10b981' : '#040710', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{step > 2 ? '✓' : '2'}</div>
                <div style={{ height: 2, width: 30, background: step > 2 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)' }} />
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step === 3 ? '#F59E0B' : 'rgba(255,255,255,0.1)', color: step === 3 ? '#040710' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>3</div>
              </div>
              <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: '0 0 6px' }}>
                {step === 2 ? 'Verify your email' : 'Organization Profile'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>
                {step === 2 ? `We sent a 6-digit code to ${email}` : 'Help us personalize your risk intelligence.'}
              </p>
            </div>
          )}

          {/* Form Body */}
          <div style={{ padding: '32px' }}>
            
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#fca5a5', padding: '10px 14px', borderRadius: '8px',
                marginBottom: '24px', fontSize: '13px', lineHeight: '1.4',
              }}>
                {error}
              </div>
            )}

            {/* LOGIN MODE */}
            {mode === 'login' && (
              <form onSubmit={handleLogin}>
                <InputField label="Work Email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@company.com" required />
                <InputField label="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '8px', background: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B', color: '#040710', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif' }}>
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* SIGNUP STEP 1: Basic Info */}
            {mode === 'signup' && step === 1 && (
              <form onSubmit={handleSignupStep1}>
                <InputField label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required />
                <InputField label="Work Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 chars" required />
                  <InputField label="Confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '8px', background: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B', color: '#040710', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif' }}>
                  {loading ? 'Creating Account...' : 'Continue'}
                </button>
              </form>
            )}

            {/* SIGNUP STEP 2: OTP Verification */}
            {mode === 'signup' && step === 2 && (
              <form onSubmit={handleSignupStep2}>
                <InputField label="Verification Code" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" required />
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: '8px', background: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B', color: '#040710', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif' }}>
                  {loading ? 'Verifying...' : 'Verify Email'}
                </button>
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                    ← Back to edit email
                  </button>
                </div>
              </form>
            )}

            {/* SIGNUP STEP 3: Company Profile */}
            {mode === 'signup' && step === 3 && (
              <form onSubmit={handleSignupStep3}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InputField label="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Imports LLC" required />
                  <InputField label="HQ Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" required />
                </div>
                
                <SelectField
                  label="Industry / Sector"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  options={[
                    { value: 'Retail / E-commerce', label: 'Retail / E-commerce' },
                    { value: 'Manufacturing', label: 'Manufacturing' },
                    { value: 'Automotive', label: 'Automotive' },
                    { value: 'Electronics / Tech', label: 'Electronics / Tech' },
                    { value: 'Logistics / 3PL', label: 'Logistics / 3PL' },
                    { value: 'Healthcare / Pharma', label: 'Healthcare / Pharma' },
                    { value: 'Other', label: 'Other' },
                  ]}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InputField label="Years in Business" type="number" value={years} onChange={(e) => setYears(e.target.value)} placeholder="e.g. 5" required />
                  <SelectField
                    label="Average Revenue"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                    required
                    options={[
                      { value: '< $1M', label: 'Less than $1M' },
                      { value: '$1M - $10M', label: '$1M - $10M' },
                      { value: '$10M - $50M', label: '$10M - $50M' },
                      { value: '$50M+', label: '$50M+' },
                    ]}
                  />
                </div>

                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', padding: '12px 14px', marginTop: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>🚀</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                    Finishing unlocks your <strong style={{ color: '#10b981' }}>24-hour Pro Trial</strong> with full access to the Supplier Panel.
                  </span>
                </div>

                <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? 'rgba(245,158,11,0.5)' : '#F59E0B', color: '#040710', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif' }}>
                  {loading ? 'Finalizing Setup...' : 'Complete Setup →'}
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
