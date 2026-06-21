import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CheckoutForm } from '../components/CheckoutForm';
import { useAuth, useUser } from '@clerk/clerk-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_51TkWQk3SyU0h0lURPkkzvH3Qv43F7J7bTQmB4oid3QulxjamqirhKJEqhb4T8qACVfeeJyYHDl0ToUzLKQWlsSS200IjK6WGE5");
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function DummyPaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Passed from SubscriptionPage navigate state
  const planId = location.state?.planId || 'pro';
  const billing = location.state?.billing || 'monthly';
  const amount = location.state?.amount || 149;

  useEffect(() => {
    async function initPayment() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/v2/payment/create-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ plan_id: `${planId}-${billing}` })
        });

        if (res.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }

        const data = await res.json();
        if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to initialize payment');

        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err.message || 'Failed to connect to payment service.');
      } finally {
        setLoading(false);
      }
    }

    initPayment();
  }, [planId, billing, getToken]);

  const handlePaymentSuccess = (updatedSubscription) => {
    // With Clerk, we no longer need to call login() locally.
    // The subscription status is fetched dynamically via ProtectedRoute.
    navigate('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#040710',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#0a0f1e',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '40px',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
      }}>
        
        <h1 style={{ color: 'white', margin: '0 0 12px', fontSize: 24, textAlign: 'center' }}>
          Secure Checkout
        </h1>
        
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 32px', fontSize: 14, textAlign: 'center' }}>
          You are upgrading to the <strong>{planId.toUpperCase()}</strong> plan ({billing}). <br/>
          Total amount: <strong style={{ color: '#10B981' }}>${amount}</strong>
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px 0' }}>
            <div style={{ width: 30, height: 30, border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            Initializing Stripe...
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 16, borderRadius: 8, color: '#fca5a5', textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px' }}>{error}</p>
            <button onClick={() => navigate('/subscription')} style={{ background: '#374151', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
              Go Back
            </button>
          </div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#F59E0B', colorBackground: '#111827', colorText: '#ffffff' } } }}>
            <CheckoutForm
              amount={amount}
              planId={`${planId}-${billing}`}
              onSuccess={handlePaymentSuccess}
              onCancel={() => navigate('/subscription')}
            />
          </Elements>
        ) : null}
      </div>
    </div>
  );
}
