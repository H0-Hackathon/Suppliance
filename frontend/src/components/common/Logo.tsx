import React from 'react';
import logoSvg from '../../assets/logo.svg';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 32, withWordmark = false, className }) => {
  if (withWordmark) {
    return (
      <div className={`flex items-center gap-3 ${className || ''}`}>
        <img
          src={logoSvg}
          alt="Suppliance"
          width={size}
          height={size}
          style={{ borderRadius: 8, flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: size * 0.55,
            fontWeight: 700,
            color: '#E8E2D8',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          Suppliance
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoSvg}
      alt="Suppliance"
      width={size}
      height={size}
      style={{ borderRadius: 8, display: 'block' }}
      className={className}
    />
  );
};
