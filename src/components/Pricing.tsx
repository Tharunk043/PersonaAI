import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const pricingPlans = [
  {
    name: 'Basic',
    price: 29,
    features: [
      'Create 1 AI persona',
      'Up to 1,000 interactions per month',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: 79,
    features: [
      'Create 5 AI personas',
      'Up to 10,000 interactions per month',
      'Advanced analytics',
      'Priority email support',
      'Custom voice integration',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: [
      'Unlimited AI personas',
      'Unlimited interactions',
      'Real-time analytics dashboard',
      '24/7 dedicated support',
      'Custom integrations',
      'White-label solution',
    ],
  },
];

const Pricing: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Pricing Plans
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Choose the perfect plan for your influencer replication needs
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {pricingPlans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{plan.name}</h2>
              <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-6">
                ${typeof plan.price === 'number' ? plan.price : plan.price}
                {typeof plan.price === 'number' && <span className="text-base font-normal text-gray-600 dark:text-gray-400">/mo</span>}
              </p>
              <ul className="mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center mb-2 text-gray-600 dark:text-gray-300">
                    <Check className="h-5 w-5 text-green-500 mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 pb-6">
              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out">
                Get Started
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Pricing;