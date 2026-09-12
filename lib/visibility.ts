import { useEffect, useRef } from "react";

export function useOnVisible(
  onVisible: (resumedFromHidden: boolean) => void,
) {
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }

      if (document.visibilityState === "visible") {
        const resumedFromHidden = wasHiddenRef.current;
        wasHiddenRef.current = false;
        onVisibleRef.current(resumedFromHidden);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
