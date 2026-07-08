import { useMutation, useQuery } from "@tanstack/react-query";
import apiClient from "../api/queryClient";
import { v4 as uuidv4 } from "uuid";

// Stable session ID for this browser session
const SESSION_ID = uuidv4();

/**
 * Custom hook wrapping React Query mutation around POST /api/query.
 * Returns { mutate, data, isPending, isError, error, reset }.
 */
export function useQueryAgent() {
  return useMutation({
    mutationFn: async (question) => {
      const { data } = await apiClient.post("/api/query", {
        question,
        session_id: SESSION_ID,
      });
      // data: { intent, generated_sql, rows, summary }
      return data;
    },
    retry: 1,
  });
}

/**
 * Hook to fetch query history for the current session.
 */
export function useQueryHistory() {
  return useQuery({
    queryKey: ["history", SESSION_ID],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/history?session_id=${SESSION_ID}`);
      return data ?? [];
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
