import React from 'react';

/** Signature CKLabs : carré ocre « CK » + nom du produit (CK en encre, suffixe en ocre). */
const CKLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; product?: string; subtitle?: string }> = ({ size = 'md', product = 'Money', subtitle }) => {
  const box = size === 'lg' ? 'w-14 h-14 text-xl rounded-2xl' : size === 'sm' ? 'w-8 h-8 text-xs rounded-lg' : 'w-11 h-11 text-base rounded-xl';
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <div className="flex items-center gap-3">
      <div className={`${box} bg-ochre text-white font-black flex items-center justify-center tracking-tight shrink-0`} style={{ background: '#C98A1E' }}>CK</div>
      <div className="leading-none">
        <div className={`${text} font-black tracking-tight`} style={{ color: '#1C2551' }}>CK<span style={{ color: '#C98A1E' }}>{product}</span></div>
        {subtitle && <div className="text-[9px] font-bold uppercase tracking-[0.25em] mt-1" style={{ color: '#6B6F80' }}>{subtitle}</div>}
      </div>
    </div>
  );
};

export default CKLogo;
