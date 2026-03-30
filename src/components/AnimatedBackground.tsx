import { motion } from "framer-motion";

const particles = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: `${(i * 17) % 100}%`,
  top: `${(i * 29) % 100}%`,
  size: 1 + (i % 4),
  duration: 16 + (i % 10),
  delay: (i % 8) * 0.4,
}));

const shapes = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 11) % 84)}%`,
  top: `${12 + ((i * 13) % 72)}%`,
  size: 40 + (i % 4) * 24,
  duration: 28 + (i % 5) * 6,
  isCircle: i % 2 === 0,
}));

const AnimatedBackground = () => {
  return (
    <div className="animated-bg fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="animated-bg-base absolute inset-0" />

      <motion.div
        className="animated-bg-orb-a absolute -top-56 -left-40 h-[42rem] w-[42rem] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(37,99,235,0.28), transparent 68%)",
          filter: "blur(110px)",
        }}
        animate={{ x: [0, 80, 20, 0], y: [0, -60, 30, 0], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 56, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="animated-bg-orb-b absolute -bottom-64 -right-56 h-[48rem] w-[48rem] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.22), transparent 72%)",
          filter: "blur(130px)",
        }}
        animate={{ x: [0, -90, -20, 0], y: [0, 70, -40, 0], opacity: [0.14, 0.28, 0.14] }}
        transition={{ duration: 70, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <motion.div
        className="animated-bg-grid absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
        }}
        animate={{ opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className="absolute"
          style={{
            left: shape.left,
            top: shape.top,
            width: `${shape.size}px`,
            height: `${shape.size}px`,
            borderRadius: shape.isCircle ? "9999px" : "10px",
            border: `1px solid ${shape.isCircle ? "rgba(59,130,246,0.28)" : "rgba(168,85,247,0.26)"}`,
          }}
          animate={{
            x: [0, (shape.id % 2 === 0 ? 48 : -48), 0],
            y: [0, (shape.id % 3 === 0 ? -36 : 36), 0],
            rotate: shape.isCircle ? [0, 360] : [0, 180, 0],
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{ duration: shape.duration, repeat: Infinity, ease: "easeInOut", delay: shape.id * 0.5 }}
        />
      ))}

      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.id % 3 === 0 ? "#22d3ee" : p.id % 3 === 1 ? "#3b82f6" : "#8b5cf6",
            boxShadow:
              p.id % 3 === 0
                ? "0 0 10px rgba(34,211,238,0.9)"
                : p.id % 3 === 1
                ? "0 0 10px rgba(59,130,246,0.9)"
                : "0 0 10px rgba(139,92,246,0.9)",
            opacity: 0.65,
          }}
          animate={{
            x: [0, (p.id % 2 === 0 ? 65 : -65), 0],
            y: [0, (p.id % 3 === 0 ? -55 : 55), 0],
            scale: [0.8, 1.35, 0.8],
            opacity: [0.25, 0.8, 0.25],
          }}
          transition={{ duration: p.duration, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
        />
      ))}

      {[0, 1, 2].map((i) => (
        <motion.div
          key={`wave-${i}`}
          className="absolute h-px w-full"
          style={{
            top: `${26 + i * 18}%`,
            background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)",
          }}
          animate={{ x: ["-100%", "100%"], opacity: [0, 0.35, 0] }}
          transition={{ duration: 20 + i * 5, repeat: Infinity, ease: "easeInOut", delay: i * 1.3 }}
        />
      ))}
    </div>
  );
};

export default AnimatedBackground;
