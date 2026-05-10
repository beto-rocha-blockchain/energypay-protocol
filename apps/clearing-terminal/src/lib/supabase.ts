import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// impede websocket no SSR
if (typeof window !== "undefined") {
  supabase
    .channel("settlements-live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "settlements",
      },
      (payload) => {
        console.log(
          "NEW SETTLEMENT:",
          payload
        );
      }
    )
    .subscribe((status) => {
      console.log(
        "SUPABASE REALTIME STATUS:",
        status
      );
    });
}