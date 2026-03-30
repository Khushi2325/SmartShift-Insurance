import { motion } from "framer-motion";
import { useState } from "react";

const Interactive3D = () => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = e.clientX - centerX;
    const y = e.clientY - centerY;

    const rotX = (y / rect.height) * 20;
    const rotY = (x / rect.width) * -20;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovering(false);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  return (
    <div className="w-full h-auto flex items-center justify-center perspective">
      <motion.div
        style={{
          perspective: "1200px",
        }}
        animate={{
          rotateX: !isHovering ? 0 : rotateX,
          rotateY: !isHovering ? 0 : rotateY,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        className="w-full"
      >
        <div
          style={{
            transformStyle: "preserve-3d",
          }}
          className="relative w-full max-w-lg mx-auto aspect-square md:aspect-auto md:h-96"
        >
          {/* Outer glow */}
          <motion.div
            animate={{
              boxShadow: isHovering
                ? "0 0 80px rgba(37, 99, 235, 0.6), 0 0 120px rgba(169, 85, 45, 0.3)"
                : "0 0 40px rgba(37, 99, 235, 0.3), 0 0 80px rgba(169, 85, 45, 0.1)",
            }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 rounded-3xl"
          />

          {/* Main card container */}
          <div className="relative w-full h-full">
            {/* Back layer - Dark */}
            <motion.div
              animate={{
                y: isHovering ? -8 : 0,
              }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl"
              style={{
                transform: "translateZ(-40px)",
              }}
            />

            {/* Animated gradient bottom */}
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "conic-gradient(from 45deg, hsl(209 96% 60% / 0.4), hsl(169 85% 45% / 0.3), hsl(258 82% 66% / 0.3), hsl(209 96% 60% / 0.4))",
                zIndex: 1,
              }}
            />

            {/* Main content layer */}
            <motion.div
              animate={{
                y: isHovering ? -12 : 0,
              }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-900/95 via-blue-900/30 to-slate-900/95 border-2 border-cyan-400/40 backdrop-blur-2xl shadow-3xl flex flex-col items-center justify-center p-8 relative overflow-hidden"
              style={{
                zIndex: 2,
                transform: "translateZ(20px)",
              }}
            >
              {/* Animated background grid */}
              <div className="absolute inset-0 opacity-20">
                <div
                  style={{
                    backgroundImage: "linear-gradient(0deg, transparent 24%, rgba(37, 99, 235, .2) 25%, rgba(37, 99, 235, .2) 26%, transparent 27%, transparent 74%, rgba(37, 99, 235, .2) 75%, rgba(37, 99, 235, .2) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(37, 99, 235, .2) 25%, rgba(37, 99, 235, .2) 26%, transparent 27%, transparent 74%, rgba(37, 99, 235, .2) 75%, rgba(37, 99, 235, .2) 76%, transparent 77%, transparent)",
                    backgroundSize: "50px 50px",
                  }}
                  className="w-full h-full rounded-3xl"
                />
              </div>

              {/* Logo container */}
              <motion.div
                animate={{
                  y: [0, -12, 0],
                  scale: isHovering ? 1.1 : 1,
                }}
                transition={{
                  y: {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                  scale: {
                    duration: 0.3,
                  },
                }}
                className="mb-6 relative z-10"
              >
                <img
                  src="/logo%202.png"
                  alt="SmartShift"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl filter brightness-110"
                  style={{
                    filter: "drop-shadow(0 0 30px rgba(37, 99, 235, 0.5))",
                  }}
                />
              </motion.div>

              {/* Text content */}
              <div className="relative z-10 text-center">
                <h3 className="font-display font-bold text-xl md:text-2xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  SmartShift Insurance
                </h3>
                <p className="text-sm md:text-base text-cyan-300/80 font-medium tracking-wide">
                  AI-Powered Protection
                </p>
              </div>

              {/* Floating dots */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    x: [Math.cos((i * Math.PI * 2) / 3) * 60, Math.cos((i * Math.PI * 2) / 3 + 1) * 60],
                    y: [Math.sin((i * Math.PI * 2) / 3) * 60, Math.sin((i * Math.PI * 2) / 3 + 1) * 60],
                  }}
                  transition={{
                    duration: 8 + i,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute w-2 h-2 rounded-full bg-cyan-400/60 blur-sm"
                  style={{
                    zIndex: 5,
                    top: "50%",
                    left: "50%",
                  }}
                />
              ))}
            </motion.div>

            {/* Front glossy layer */}
            <div
              className="absolute inset-0 rounded-3xl border-2 border-cyan-300/30 shadow-2xl pointer-events-none"
              style={{
                transform: "translateZ(50px)",
                background: "linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, transparent 50%, rgba(34, 211, 238, 0.05) 100%)",
              }}
            />
          </div>

          {/* Orbiting lights */}
          <motion.div
            animate={{
              x: [0, 40, 0, -40, 0],
              y: [0, -50, 30, -30, 0],
              opacity: [0.3, 0.6, 0.8, 0.4, 0.3],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-40 h-40 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(209 96% 60% / 0.3), transparent 70%)",
              filter: "blur(40px)",
              top: "-60px",
              left: "-60px",
              zIndex: 0,
            }}
          />
          <motion.div
            animate={{
              x: [0, -50, 30, 40, 0],
              y: [0, 60, -40, 20, 0],
              opacity: [0.3, 0.5, 0.7, 0.4, 0.3],
            }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(169 85% 45% / 0.25), transparent 70%)",
              filter: "blur(50px)",
              bottom: "-80px",
              right: "-80px",
              zIndex: 0,
            }}
          />
          <motion.div
            animate={{
              x: [0, 30, -50, 20, 0],
              y: [0, -30, 50, -20, 0],
              opacity: [0.2, 0.5, 0.6, 0.3, 0.2],
            }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute w-44 h-44 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, hsl(258 82% 66% / 0.2), transparent 70%)",
              filter: "blur(45px)",
              top: "10%",
              right: "-100px",
              zIndex: 0,
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default Interactive3D;
