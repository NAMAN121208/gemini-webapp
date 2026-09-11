import React from 'react';

export default function Logo({ className = "w-full max-w-[600px] mx-auto", showText = true }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={showText ? "0 0 700 200" : "0 0 200 200"} className={className}>
      <g transform={showText ? "translate(50, 15)" : "translate(10, 15)"}>
        {/* Right half of the shield */}
        <path d="M 90 15 L 150 15 L 150 75 C 150 115 120 145 90 155" 
              fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="8" strokeLinecap="square" strokeLinejoin="miter"/>
              
        {/* Left half of the shield */}
        <path d="M 90 15 L 30 15 L 30 65" 
              fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="8" strokeLinecap="square" />
              
        {/* Left half architectural pillars */}
        <path d="M 22 80 L 22 135" fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="6" />
        <path d="M 38 80 L 38 135" fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="6" />
        <path d="M 12 135 L 48 135" fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="6" strokeLinecap="square" />
        <path d="M 12 80 L 48 80" fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="6" strokeLinecap="square" />

        {/* Crosshair / Map Pinpoint */}
        <circle cx="90" cy="75" r="18" fill="none" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="4" />
        <line x1="90" y1="42" x2="90" y2="62" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
        <line x1="90" y1="88" x2="90" y2="108" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
        <line x1="57" y1="75" x2="77" y2="75" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
        <line x1="103" y1="75" x2="123" y2="75" className="stroke-civic-primary dark:stroke-blue-400" strokeWidth="4" strokeLinecap="round" />
        
        {/* Urgent Crimson Accent Dot */}
        <circle cx="90" cy="75" r="6" fill="#E53E3E" />
      </g>

      {showText && (
        <>
          <text x="250" y="110" className="fill-civic-primary dark:fill-blue-400" style={{ fontFamily: "'Inter', 'Arial Black', sans-serif", fontWeight: 900, fontSize: '64px' }}>CIVICSHIELD</text>
          <text x="255" y="145" className="fill-gray-500 dark:fill-gray-400" style={{ fontFamily: "'Inter', 'Arial', sans-serif", fontWeight: 600, fontSize: '15px', letterSpacing: '3px' }}>THE BRIDGE TO MUNICIPAL ACTION</text>
        </>
      )}
    </svg>
  );
}
