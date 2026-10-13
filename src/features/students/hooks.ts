import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { StudentInput, StudentQuery } from "../../lib/types";
import { invalidateAfterStudent } from "../invalidate";
import { qk } from "../queryKeys";

export const useStudents = (query: StudentQuery = {}) =>
  useQuery({
    queryKey: qk.studentList(query),
    queryFn: () => api.listStudents(query),
    placeholderData: keepPreviousData,
  });

export const useStudent = (id: number | undefined) =>
  useQuery({
    queryKey: qk.student(id ?? 0),
    queryFn: () => api.getStudent(id as number),
    enabled: id !== undefined && Number.isFinite(id),
  });

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) => api.createStudent(input),
    onSuccess: () => invalidateAfterStudent(qc),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: StudentInput }) => api.updateStudent(id, input),
    onSuccess: () => invalidateAfterStudent(qc),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteStudent(id),
    onSuccess: () => invalidateAfterStudent(qc),
  });
}
