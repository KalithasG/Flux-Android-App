import React from 'react';

export const FluxLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F86F7" />
        <stop offset="100%" stopColor="#2B5BCC" />
      </linearGradient>
      <linearGradient id="walletGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#6BA6FF" />
        <stop offset="100%" stopColor="#3B76E1" />
      </linearGradient>
      <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="100%" stopColor="#16A34A" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.2" />
      </filter>
    </defs>

    {/* Outer C/E Shape */}
    <path d="M 145 160 A 80 80 0 1 1 145 40 L 125 65 A 50 50 0 1 0 125 135 Z" fill="url(#blueGrad)" filter="url(#shadow)" />
    <rect x="20" y="85" width="40" height="30" fill="url(#blueGrad)" />

    {/* Wallet Back */}
    <path d="M 75 65 L 145 65 A 10 10 0 0 1 155 75 L 155 125 A 10 10 0 0 1 145 135 L 75 135 A 10 10 0 0 1 65 125 L 65 75 A 10 10 0 0 1 75 65 Z" fill="#93C5FD" />
    <path d="M 70 70 L 140 70 A 10 10 0 0 1 150 80 L 150 130 A 10 10 0 0 1 140 140 L 70 140 A 10 10 0 0 1 60 130 L 60 80 A 10 10 0 0 1 70 70 Z" fill="url(#walletGrad)" filter="url(#shadow)" />
    
    {/* Wallet Flap/Button */}
    <circle cx="135" cy="105" r="6" fill="#BFDBFE" />
    <circle cx="135" cy="105" r="3" fill="#60A5FA" />

    {/* Rupee Symbol */}
    <text x="100" y="115" fontFamily="sans-serif" fontSize="36" fill="white" textAnchor="middle" fontWeight="bold">₹</text>

    {/* Green Arrow */}
    <path d="M 50 130 Q 110 150 160 70 L 140 70 L 175 45 L 180 85 L 160 70 Q 110 130 50 110 Z" fill="url(#arrowGrad)" filter="url(#shadow)" />
  </svg>
);
