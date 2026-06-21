import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Anchor } from 'lucide-react';
import { SoftButton } from '../motion/SoftButton';

export const MarketingNav: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="mkt-nav">
      <div className="mkt-nav-inner">
        <Link to="/" className="mkt-nav-brand" aria-label="CoastGuard home">
          <span className="mkt-nav-icon">
            <Anchor size={20} strokeWidth={2} />
          </span>
          <span className="mkt-nav-name">CoastGuard</span>
        </Link>

        <nav className="mkt-nav-links" aria-label="Primary">
          <a href="#scenario">A real example</a>
          <a href="#process">How it works</a>
        </nav>

        <SoftButton
          variant="primary"
          className="mkt-nav-signin"
          onClick={() => navigate('/dashboard')}
        >
          Sign in
        </SoftButton>
      </div>
    </header>
  );
};
