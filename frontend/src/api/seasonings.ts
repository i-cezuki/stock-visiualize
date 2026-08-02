import { apiClient } from "./client";
import type { Seasoning, CreateSeasoningInput, UpdateSeasoningInput } from "../types/seasoning";

export const seasoningsApi = {
  list: () => apiClient.get<Seasoning[]>("/seasonings"),
  create: (input: CreateSeasoningInput) => apiClient.post<Seasoning>("/seasonings", input),
  update: (id: string, patch: UpdateSeasoningInput) =>
    apiClient.patch<Seasoning>(`/seasonings/${id}`, patch),
  remove: (id: string) => apiClient.delete(`/seasonings/${id}`),
};
