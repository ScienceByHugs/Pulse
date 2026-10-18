import { useEffect, useState } from 'react';
import { authEmailGate } from '@/lib/authEmail';

export function useAuthEmailCooldown() {
  const [seconds, setSeconds] = useState(authEmailGate.remainingSeconds);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(authEmailGate.remainingSeconds()), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}
