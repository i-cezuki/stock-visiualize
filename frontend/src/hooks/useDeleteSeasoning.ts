import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";
import { SEASONINGS_QUERY_KEY } from "./useSeasonings";

export function useDeleteSeasoning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => seasoningsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEASONINGS_QUERY_KEY }),
  });
}
