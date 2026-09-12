import { useEffect, useRef } from "react";

export function useOnVisible(onVisible: () => void) {
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        onVisibleRef.current();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
