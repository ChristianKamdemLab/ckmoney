import React from 'react';

/** Signature CKLabs : carré ocre « CK » + nom du produit (CK en encre, suffixe en ocre). */
const CKLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; product?: string; subtitle?: string; tone?: 'dark' | 'light' }> = ({ size = 'md', product = 'Money', subtitle, tone = 'dark' }) => {
  const text = size === 'lg' ? 'text-[30px]' : size === 'sm' ? 'text-[17px]' : 'text-[22px]';
  const ink = tone === 'light' ? '#F7F3EA' : '#0E1533';
  return (
    <div className="leading-none">
      <div className={`${text} display font-extrabold`} style={{ color: ink, fontFamily: "Unbounded, Manrope, sans-serif", fontWeight: 800, letterSpacing: '0.01em' }}>
        CK<span style={{ color: '#FFC23D' }}>·</span>{product.toUpperCase()}
      </div>
      {subtitle && <div className="text-[9px] font-bold uppercase tracking-[0.25em] mt-1.5" style={{ color: tone === 'light' ? '#A9B1D6' : '#5B6285' }}>{subtitle}</div>}
    </div>
  );
};

export default CKLogo;
