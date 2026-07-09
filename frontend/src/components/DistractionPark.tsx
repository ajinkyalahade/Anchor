import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X } from 'lucide-react';
import { Card, IconButton } from './ui';

export default function DistractionPark() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [distractions, setDistractions] = useState<string[]>([]);

  const handleSave = () => {
    if (text.trim()) {
      setDistractions([...distractions, text.trim()]);
      setText('');
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        className="fixed bottom-24 right-5 w-14 h-14 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-full shadow-lg flex items-center justify-center border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] z-40"
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
      >
        <MessageSquarePlus size={24} />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-bg-canvas)_80%,transparent)] backdrop-blur-sm p-5"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md"
            >
              <Card padding="lg" variant="glass">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Park a thought</h3>
                  <IconButton icon={<X size={20} />} label="Close" size="sm" onClick={() => setIsOpen(false)} />
                </div>
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What's distracting you? Write it down and return to it later."
                  className="w-full h-32 bg-[var(--color-bg-canvas)] border border-[color-mix(in_srgb,var(--color-text-muted)_15%,transparent)] rounded-xl p-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-focus)] resize-none"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSave}
                    className="px-6 py-2.5 bg-[var(--color-accent-focus)] text-white font-medium rounded-xl hover:brightness-110 transition-all active:scale-95"
                  >
                    Park it
                  </button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
