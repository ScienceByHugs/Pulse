import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
export function useReduceMotion() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setEnabled,
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return enabled;
}
