import { QueryClient } from "@tanstack/react-query";

export function getQueryContext() {
  const queryClient = new QueryClient();

  return {
    queryClient,
  };
}
