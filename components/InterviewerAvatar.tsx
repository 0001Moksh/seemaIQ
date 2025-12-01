import { motion } from "framer-motion";
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};
export default function InterviewerAvatar({ isListening, isThinking }: { isListening: boolean; isThinking: boolean }) {
  return (
    <div className="relative w-80 h-80">
      <motion.div
        animate={{
          scale: isListening ? [1, 1.08, 1] : isThinking ? [1, 0.98, 1] : 1,
          rotate: isThinking ? [-3, 3, -3] : 0,
        }}
        transition={{ duration: isListening ? 2 : 3, repeat: Infinity }}
        className="w-full h-full rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl flex items-center justify-center"
      >
        <span className="text-white text-9xl">
          {isListening ? "Speaking" : isThinking ? "Thinking" : "Smiling"}
        </span>
      </motion.div>
      {isListening && (
        <div className="absolute -inset-4 rounded-full border-8 border-green-500/50 animate-ping" />
      )}
    </div>
  );
}