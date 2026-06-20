import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function CheckoutForm({ onSuccess, onCancel, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    // Trigger form validation and wallet collection
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setLoading(false);
      return;
    }

    // In a real app, we'd use stripe.confirmPayment, but because we are simulating
    // a dummy successful payment and don't actually have a registered webhook or a valid return_url setup
    // for this local environment, we'll hit our own backend /confirm endpoint manually.
    
    try {
      const res = await fetch(`${API_URL}/api/v2/payment/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('coastguard_token')}`
        },
        body: JSON.stringify({ payment_intent_id: "dummy_intent" })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Payment confirmation failed");
      
      onSuccess(data.subscription);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stripe Payment Element handles all inputs (card, expiry, cvc) automatically based on the intent */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
         <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: '13px', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1, padding: '12px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
            color: 'white', fontWeight: '600', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          style={{
            flex: 2, padding: '12px', background: '#F59E0B',
            border: 'none', borderRadius: '8px', color: '#040710',
            fontWeight: '700', cursor: loading || !stripe ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Processing...' : `Pay $${amount}`}
        </button>
      </div>
      
      <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
        Use dummy card: 4242 4242 4242 4242 (Any future date / CVC)
      </div>
    </form>
  );
}
