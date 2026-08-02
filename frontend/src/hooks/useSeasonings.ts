import { useQuery } from "@tanstack/react-query";
import { seasoningsApi } from "../api/seasonings";

export const SEASONINGS_QUERY_KEY = ["seasonings"] as const;

export function useSeasonings() {
  return useQuery({
    queryKey: SEASONINGS_QUERY_KEY,
    queryFn: seasoningsApi.list,
  });
}
