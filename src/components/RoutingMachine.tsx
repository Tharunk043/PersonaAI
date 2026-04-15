import { useEffect, useRef } from 'react';
import L, { LatLng } from 'leaflet';
import 'leaflet-routing-machine';
import { useMap } from 'react-leaflet';

type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
};

type Props = {
  waypoints: LatLng[];                      // stable L.LatLng instances
  onRoute?: (summary: RouteSummary) => void;
};

const RoutingMachine: React.FC<Props> = ({ waypoints, onRoute }) => {
  const map = useMap();
  const controlRef = useRef<L.Routing.Control | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  // init control once
  useEffect(() => {
    if (!map || controlRef.current) return;

    const plan = L.Routing.plan([], {
      draggableWaypoints: true,
      addWaypoints: false,
    });

    const control = L.Routing.control({
      plan,
      routeWhileDragging: false,
      fitSelectedRoutes: false,
      show: false,
      router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
      lineOptions: {
        styles: [{ color: '#4F46E5', weight: 5, opacity: 0.9 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      } as L.Routing.LineOptions,
    }).addTo(map);

    const handler = (e: any) => {
      const first = e.routes?.[0];
      if (!first || !onRouteRef.current) return;
      const distanceMeters = first.summary?.totalDistance ?? 0;
      const durationSeconds = first.summary?.totalTime ?? 0;
      const coords: [number, number][] = (first.coordinates || []).map((c: any) => [c.lat, c.lng]);
      onRouteRef.current({ distanceMeters, durationSeconds, coordinates: coords });
    };

    (control as any).on('routesfound', handler);
    controlRef.current = control;

    return () => {
      if (controlRef.current) {
        (controlRef.current as any).off('routesfound', handler);
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map]);

  // update waypoints in place (no blinking)
  useEffect(() => {
    const ctl = controlRef.current;
    if (!ctl) return;
    const plan = ctl.getPlan() as any;
    plan.setWaypoints(waypoints);
  }, [waypoints]);

  return null;
};

export default RoutingMachine;
