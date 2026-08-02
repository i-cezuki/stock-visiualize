import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";
import { SEASONINGS_QUERY_KEY } from "./useSeasonings";
import type { UpdateSeasoningInput } from "../types/seasoning";

export function useUpdateSeasoning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSeasoningInput }) =>
      seasoningsApi.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEASONINGS_QUERY_KEY }),
  });
}
