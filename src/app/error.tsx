"use client";

import { useEffect } from "react";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState action={<Button variant="primary" onClick={() => retry()}>Try again</Button>}>
      Something went wrong loading this page. Try again, and if it keeps failing check the server log.
    </EmptyState>
  );
}
