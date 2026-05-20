import { Suspense } from 'react';
import CallStation from '../../components/CallStation';

// Suspense is required because CallStation reads URL search params at render time
export default function StationPage() {
  return (
    <Suspense fallback={null}>
      <CallStation />
    </Suspense>
  );
}
