import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { qk } from "../queryKeys";

export const useStats = () => useQuery({ queryKey: qk.stats, queryFn: () => api.getStats() });
