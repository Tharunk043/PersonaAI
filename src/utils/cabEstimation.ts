/**
 * Transportation estimation logic for various modes.
 * Rates are heuristics based on typical Indian travel pricing (2024-25).
 */

export interface TransportEstimate {
  type: 'Bike' | 'Auto' | 'Cab' | 'Bus' | 'Train' | 'Flight';
  cost: number;
  durationMins: number;
  description: string;
  icon: string;
}

export const estimateTransportCosts = (distanceMeters: number, durationSeconds: number): TransportEstimate[] => {
  const distanceKm = distanceMeters / 1000;
  const roadDurationMins = Math.round(durationSeconds / 60);

  if (distanceKm < 1) return [];

  const estimates: TransportEstimate[] = [];

  // 1. Bike (practical up to ~30 km)
  if (distanceKm <= 30) {
    const cost = Math.max(35, 25 + distanceKm * 8);
    estimates.push({ type: 'Bike', cost: Math.round(cost), durationMins: roadDurationMins, description: `~${distanceKm.toFixed(0)} km ride`, icon: '🏍️' });
  }

  // 2. Auto (practical up to ~40 km)
  if (distanceKm <= 40) {
    const cost = Math.max(50, 40 + distanceKm * 14);
    estimates.push({ type: 'Auto', cost: Math.round(cost), durationMins: roadDurationMins, description: `~${distanceKm.toFixed(0)} km ride`, icon: '🛺' });
  }

  // 3. Cab (any road distance)
  {
    const cost = Math.max(100, 80 + distanceKm * 14);
    const durHrs = Math.round(roadDurationMins / 60);
    estimates.push({ type: 'Cab', cost: Math.round(cost), durationMins: roadDurationMins, description: `~${durHrs}h drive · ${distanceKm.toFixed(0)} km`, icon: '🚗' });
  }

  // 4. Bus (practical up to ~1200 km)
  if (distanceKm >= 20 && distanceKm <= 1200) {
    const cost = Math.max(80, 50 + distanceKm * 1.5);
    const busDur = Math.round(roadDurationMins * 1.2) + 30;
    const durHrs = Math.round(busDur / 60);
    estimates.push({ type: 'Bus', cost: Math.round(cost), durationMins: busDur, description: `~${durHrs}h · Volvo AC Sleeper`, icon: '🚌' });
  }

  // 5. Train (practical 100+ km)
  if (distanceKm >= 100) {
    const cost = Math.max(200, 120 + distanceKm * 1.2);
    const trainDur = Math.round((distanceKm / 60) * 60) + 45;
    const durHrs = Math.round(trainDur / 60);
    estimates.push({ type: 'Train', cost: Math.round(cost), durationMins: trainDur, description: `~${durHrs}h · 3A/2A Class`, icon: '🚆' });
  }

  // 6. Flight (practical 400+ km)
  if (distanceKm >= 400) {
    const cost = Math.max(2500, 1800 + distanceKm * 3.5);
    const flightDur = Math.round((distanceKm / 750) * 60) + 150; // flight + airport buffer
    const durHrs = (flightDur / 60).toFixed(1);
    estimates.push({ type: 'Flight', cost: Math.round(cost), durationMins: Math.round(flightDur), description: `~${durHrs}h · Economy`, icon: '✈️' });
  }

  return estimates;
};
