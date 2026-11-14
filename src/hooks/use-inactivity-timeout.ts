import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";

export const DEFAULT_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)
export const DEFAULT_INACTIVITY_WARNING_MS = 1 * 60 * 1000; // 1 minute (60,000 ms)
export const AGENT_LAST_ACTIVITY_KEY = "scheme_compass_agent_last_activity";
export const AGENT_LOGOUT_EVENT_KEY = "scheme_compass_agent_logout_event";

export interface UseInactivityTimeoutOptions {
  /**
   * Total inactivity duration in milliseconds before automatic logout.
   * Defaults to 10 minutes (600,000 ms).
   */
  timeoutMs?: number;
  /**
   * Warning duration in milliseconds before automatic logout.
   * Defaults to 1 minute (60,000 ms remaining, i.e., warning at 9 minutes).
   */
  warningMs?: number;
  /**
   * Whether the inactivity timeout is enabled.
   * Should be true ONLY for approved agent accounts.
   */
  enabled: boolean;
  /**
   * Callback invoked when the inactivity timeout is reached.
   */
  onTimeout: () => Promise<void> | void;
  /**
   * Storage key used to synchronize activity across browser tabs.
   */
  storageKey?: string;
  /**
   * Storage key used to broadcast logout across browser tabs.
   */
  logoutKey?: string;
}

export interface UseInactivityTimeoutReturn {
  showWarning: boolean;
  stayLoggedIn: () => void;
  resetTimer: () => void;
  timeRemainingMs: number;
}

/**
 * Reusable hook to track user activity and enforce an inactivity timeout.
 * Synchronizes activity and logout across multiple browser tabs via localStorage.
 */
export function useInactivityTimeout({
  timeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  warningMs = DEFAULT_INACTIVITY_WARNING_MS,
  enabled,
  onTimeout,
  storageKey = AGENT_LAST_ACTIVITY_KEY,
  logoutKey = AGENT_LOGOUT_EVENT_KEY,
}: UseInactivityTimeoutOptions): UseInactivityTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemainingMs, setTimeRemainingMs] = useState(timeoutMs);
  const location = useLocation();

  const lastRecordedActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  const isLoggingOutRef = useRef(false);

  // Keep latest onTimeout reference without re-triggering effects
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Read the latest activity timestamp from localStorage or in-memory ref
  const getLatestActivityTimestamp = useCallback((): number => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = Number(stored);
        if (!isNaN(parsed) && parsed > 0) {
          return Math.max(lastRecordedActivityRef.current, parsed);
        }
      }
    } catch {
      // In case localStorage is blocked/unavailable
    }
    return lastRecordedActivityRef.current;
  }, [storageKey]);

  // Record active user interaction (throttled to at most once per second)
  const recordActivity = useCallback(() => {
    if (!enabled || isLoggingOutRef.current) return;

    const now = Date.now();
    // Throttle writes to localStorage to prevent excessive storage operations on rapid events
    if (now - lastRecordedActivityRef.current >= 1000) {
      lastRecordedActivityRef.current = now;
      try {
        localStorage.setItem(storageKey, String(now));
      } catch {
        // Storage might be restricted
      }
    }

    setShowWarning((prev) => (prev ? false : prev));
  }, [enabled, storageKey]);

  // Explicitly reset timer (e.g., when agent clicks "Stay Logged In")
  const stayLoggedIn = useCallback(() => {
    const now = Date.now();
    lastRecordedActivityRef.current = now;
    try {
      localStorage.setItem(storageKey, String(now));
    } catch {
      // ignore
    }
    setShowWarning(false);
    setTimeRemainingMs(timeoutMs);
  }, [storageKey, timeoutMs]);

  // Handle logout trigger
  const triggerLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    setShowWarning(false);
    try {
      localStorage.setItem(logoutKey, String(Date.now()));
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }

    try {
      await onTimeoutRef.current();
    } catch (err) {
      console.error("Error during inactivity logout:", err);
    }
  }, [logoutKey, storageKey]);

  // Initialize timestamp when enabled becomes true
  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      isLoggingOutRef.current = false;
      return;
    }

    isLoggingOutRef.current = false;
    const now = Date.now();
    lastRecordedActivityRef.current = now;
    try {
      const existing = localStorage.getItem(storageKey);
      if (!existing || isNaN(Number(existing))) {
        localStorage.setItem(storageKey, String(now));
      } else {
        lastRecordedActivityRef.current = Math.max(now, Number(existing));
      }
    } catch {
      // ignore
    }
  }, [enabled, storageKey]);

  // Track dashboard page navigation as user activity
  useEffect(() => {
    if (enabled) {
      recordActivity();
    }
  }, [location.pathname, enabled, recordActivity]);

  // Listen to actual user interaction events
  useEffect(() => {
    if (!enabled) return;

    // Actual user activity events (NOT background fetch or API timers)
    const activityEvents = [
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];

    const handleUserInteraction = () => {
      recordActivity();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [enabled, recordActivity]);

  // Multi-tab synchronization via localStorage "storage" event
  useEffect(() => {
    if (!enabled) return;

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) {
        const remoteTimestamp = Number(event.newValue);
        if (!isNaN(remoteTimestamp) && remoteTimestamp > 0) {
          lastRecordedActivityRef.current = Math.max(
            lastRecordedActivityRef.current,
            remoteTimestamp,
          );
          const remaining = timeoutMs - (Date.now() - remoteTimestamp);
          setTimeRemainingMs(Math.max(0, remaining));
          if (remaining > warningMs) {
            setShowWarning(false);
          }
        }
      } else if (event.key === logoutKey && event.newValue) {
        // Another tab logged out
        triggerLogout();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [enabled, storageKey, logoutKey, timeoutMs, warningMs, triggerLogout]);

  // Periodic interval to evaluate inactivity elapsed time
  useEffect(() => {
    if (!enabled) return;

    const evaluateInactivity = () => {
      if (isLoggingOutRef.current) return;

      const lastActive = getLatestActivityTimestamp();
      const elapsed = Date.now() - lastActive;
      const remaining = timeoutMs - elapsed;

      setTimeRemainingMs(Math.max(0, remaining));

      if (remaining <= 0) {
        triggerLogout();
      } else if (remaining <= warningMs) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    // Run check once immediately
    evaluateInactivity();

    // Check periodically every second
    const intervalId = setInterval(evaluateInactivity, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, timeoutMs, warningMs, getLatestActivityTimestamp, triggerLogout]);

  return {
    showWarning,
    stayLoggedIn,
    resetTimer: stayLoggedIn,
    timeRemainingMs,
  };
}
