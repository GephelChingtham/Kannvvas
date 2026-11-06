"use client";

import { motion } from "framer-motion";

interface HandWrittenTitleProps {
  title?: string;
  subtitle?: string;
}

function HandWrittenTitle({
  title = "Hand Written",
  subtitle,
}: HandWrittenTitleProps) {
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          duration: 2.5,
          ease: [0.43, 0.13, 0.23, 0.96] as const,
          repeat: Infinity,
          repeatType: "loop" as const,
          repeatDelay: 0.25,
        },
        opacity: { duration: 0.5 },
      },
    },
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 sm:px-16 md:px-28 py-10 sm:py-20 my-2 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <motion.svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 520"
          preserveAspectRatio="none"
          initial="hidden"
          animate="visible"
          className="w-full h-full overflow-visible"
        >
          <title>KokonutUI</title>
          <motion.path
            d="M 1010 85
               C 1210 210, 1150 455, 600 475
               C 130 475, 35 415, 35 260
               C 35 105, 190 45, 600 45
               C 930 45, 1055 125, 1010 155"
            fill="none"
            strokeWidth="10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={draw}
            className="text-[#121214] opacity-90"
          />
        </motion.svg>
      </div>
      <div className="relative text-center z-10 flex flex-col items-center justify-center">
        <motion.h1
          className="text-2xl sm:text-5xl md:text-6xl font-black text-[#121214] tracking-tighter leading-[1.1] max-w-2xl px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            className="mt-3 text-lg sm:text-xl text-[#121214]/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.7 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </div>
  );
}

export { HandWrittenTitle };
