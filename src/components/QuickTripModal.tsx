import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MapPin, Crosshair, X, CalendarDays } from 'lucide-react';

type ConfirmPayload = {
  useCurrentLocation: boolean;
  origin?: string;
  destination: string;
  nights: number;
};

type QuickTripModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: ConfirmPayload) => void;
};

const QuickTripModal: React.FC<QuickTripModalProps> = ({ open, onClose, onConfirm }) => {
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [nights, setNights] = useState(4);
  const geoSupported = typeof window !== "undefined" && "geolocation" in navigator;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-6 mx-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Plan a Trip
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Use Current Location */}
          <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="checkbox"
              checked={useCurrentLocation}
              onChange={() => setUseCurrentLocation(!useCurrentLocation)}
              className="mt-1"
            />
            Use my current location
            {!geoSupported && <span className="text-xs text-red-500"> (Not supported)</span>}
          </label>

          {/* SOURCE */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Source</label>
            <input
              disabled={useCurrentLocation}
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g., Mumbai, India"
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
            />
            {useCurrentLocation && (
              <p className="text-xs flex items-center gap-1 mt-1 text-gray-500">
                <Crosshair className="w-3 h-3" /> Using current location
              </p>
            )}
          </div>

          {/* DESTINATION */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Destination</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g., Paris, France"
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
            />
          </div>

          {/* DAYS / NIGHTS */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">How many days?</label>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <input
                type="number"
                min={1}
                max={30}
                value={nights}
                onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                className="w-20 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
          >
            Cancel
          </button>

          {/* ✅ PLAN TRIP BUTTON */}
          <button
            onClick={() => {
              if (!destination.trim()) return;
              if (!useCurrentLocation && !origin.trim()) return;

              onConfirm({
                useCurrentLocation,
                origin: useCurrentLocation ? undefined : origin.trim(),
                destination: destination.trim(),
                nights,
              });

              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          >
            Plan Trip
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default QuickTripModal;
