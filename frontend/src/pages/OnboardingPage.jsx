import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Briefcase, MapPin, Target, BarChart2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';

export default function OnboardingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    location: '',
    years_in_business: '',
    average_revenue: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      const payload = {
        email: user?.primaryEmailAddress?.emailAddress || "unknown@clerk.dev",
        name: user?.fullName || "User",
        company_name: formData.company_name,
        industry: formData.industry,
        location: formData.location,
        years_in_business: parseInt(formData.years_in_business) || 1,
        average_revenue: formData.average_revenue
      };

      const res = await fetch('/api/v2/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Onboarding failed");
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #02040a 0%, #0a0f1e 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f8fafc'
    }}>
      <div style={{
        width: 480,
        padding: '40px',
        background: 'rgba(10, 15, 30, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 24,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Welcome to CoastGuard</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Let's customize your AI monitoring agents.</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: 12,
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>
              <Briefcase size={14} /> Company Name
            </label>
            <input
              required
              value={formData.company_name}
              onChange={e => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Acme Global Imports"
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                color: '#fff', fontSize: 14, outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>
              <Target size={14} /> Primary Industry
            </label>
            <input
              required
              value={formData.industry}
              onChange={e => setFormData({ ...formData, industry: e.target.value })}
              placeholder="e.g. Consumer Electronics"
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                color: '#fff', fontSize: 14, outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>
              <MapPin size={14} /> Primary Sourcing Region
            </label>
            <input
              required
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Shenzhen, China"
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                color: '#fff', fontSize: 14, outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>Years in Business</label>
              <input
                required
                type="number"
                value={formData.years_in_business}
                onChange={e => setFormData({ ...formData, years_in_business: e.target.value })}
                placeholder="e.g. 5"
                style={{
                  width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', fontSize: 14, outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>Annual Revenue</label>
              <input
                required
                value={formData.average_revenue}
                onChange={e => setFormData({ ...formData, average_revenue: e.target.value })}
                placeholder="e.g. $5M - $10M"
                style={{
                  width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  color: '#fff', fontSize: 14, outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            style={{
              marginTop: 16,
              width: '100%',
              padding: '14px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Setting up CoastGuard...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
