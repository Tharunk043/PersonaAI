import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export type QuickActionProps = HTMLMotionProps<'button'> & {
  title: string;
  subtitle: string;
  // Pass the component type (e.g., Globe), not <Globe />
  icon: LucideIcon; // or React.ComponentType<React.SVGProps<SVGSVGElement>>
};

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  subtitle,
  icon: Icon,
  className = '',
  // includes onClick and all motion/DOM props with correct types
  ...rest
}) => {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={
        "group w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 " +
        "bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow transition-all " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
        className
      }
      aria-label={`${title} ${subtitle}`}
      {...rest}
    >
      <div className="flex items-center gap-4">
        <div className="rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <div className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {subtitle}
          </div>
        </div>
      </div>
    </motion.button>
  );
};

export default QuickAction;
