import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";
import { SEASONINGS_QUERY_KEY } from "./useSeasonings";
import type { CreateSeasoningInput } from "../types/seasoning";

export function useCreateSeasoning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSeasoningInput) => seasoningsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEASONINGS_QUERY_KEY }),
  });
}
