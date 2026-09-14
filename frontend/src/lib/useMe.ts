import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PortalUser } from "../types/project";

export function useMe() {
  const [me, setMe] = useState<PortalUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}
