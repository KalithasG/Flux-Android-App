import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface SloganAnimationProps {
  variant?: 'header' | 'splash';
}

export const SloganAnimation = ({ variant = 'header' }: SloganAnimationProps) => {
  const text = "Control Your Expenses";
  const letters = text.split("");
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationKey(prev => prev + 1);
    }, 10000); // Re-run animation every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: variant === 'splash' ? 0.6 : 0.3 },
    },
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 200,
      },
    },
    hidden: {
      opacity: 0,
      y: 10,
      filter: "blur(4px)",
      transition: {
        type: "spring" as const,
        damping: 12,
        stiffness: 200,
      },
    },
  };

  if (variant === 'splash') {
    return (
      <motion.div
        key={`splash-${animationKey}`}
        variants={container}
        initial="hidden"
        animate="visible"
        className="text-lg text-tertiary mt-3 font-medium tracking-wide flex justify-center"
      >
        {letters.map((char, index) => (
          <motion.span variants={child} key={index} className={char === " " ? "w-1.5" : ""}>
            {char}
          </motion.span>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div 
      key={`header-${animationKey}`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
      className="flex items-center gap-2 mt-1 overflow-hidden"
    >
      <motion.div 
        variants={container}
        initial="hidden"
        animate="visible"
        className="text-[10px] uppercase font-bold text-tertiary tracking-widest flex"
      >
        {letters.map((char, index) => (
          <motion.span variants={child} key={index} className={char === " " ? "w-1" : ""}>
            {char}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
};
