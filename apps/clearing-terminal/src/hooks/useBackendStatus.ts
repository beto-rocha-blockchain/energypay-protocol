import { useEffect, useState } from "react";
import { getHealthStatus } from "@/services/api";

export function useBackendStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const data = await getHealthStatus();

        setStatus(data);
        setOnline(true);
      } catch (err) {
        console.error(err);
        setOnline(false);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  return {
    status,
    loading,
    online,
  };
}