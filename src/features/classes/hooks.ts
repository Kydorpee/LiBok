import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ClassInput, ClassQuery, ClassReadingInput } from "../../lib/types";
import { invalidateAfterClass, invalidateAfterClassReading } from "../invalidate";
import { qk } from "../queryKeys";

export const useClasses = (query: ClassQuery = {}) =>
  useQuery({
    queryKey: qk.classList(query),
    queryFn: () => api.listClasses(query),
    placeholderData: keepPreviousData,
  });

export const useClass = (id: number | undefined) =>
  useQuery({
    queryKey: qk.classDetail(id ?? 0),
    queryFn: () => api.getClass(id as number),
    enabled: id !== undefined && Number.isFinite(id),
  });

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClassInput) => api.createClass(input),
    onSuccess: () => invalidateAfterClass(qc),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ClassInput }) => api.updateClass(id, input),
    onSuccess: () => invalidateAfterClass(qc),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteClass(id),
    onSuccess: () => invalidateAfterClass(qc),
  });
}

export const useClassReadings = (classId: number | undefined) =>
  useQuery({
    queryKey: qk.classReadingList(classId ?? 0),
    queryFn: () => api.listClassReadings(classId as number),
    enabled: classId !== undefined && Number.isFinite(classId),
  });

export function useCreateClassReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClassReadingInput) => api.createClassReading(input),
    onSuccess: () => invalidateAfterClassReading(qc),
  });
}

export function useDeleteClassReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteClassReading(id),
    onSuccess: () => invalidateAfterClassReading(qc),
  });
}
