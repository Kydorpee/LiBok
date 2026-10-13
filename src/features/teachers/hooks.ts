import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { TeacherInput } from "../../lib/types";
import { invalidateAfterTeacher } from "../invalidate";
import { qk } from "../queryKeys";

export const useTeachers = (text?: string) =>
  useQuery({
    queryKey: qk.teacherList(text),
    queryFn: () => api.listTeachers(text),
    placeholderData: keepPreviousData,
  });

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TeacherInput) => api.createTeacher(input),
    onSuccess: () => invalidateAfterTeacher(qc),
  });
}

export function useUpdateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TeacherInput }) => api.updateTeacher(id, input),
    onSuccess: () => invalidateAfterTeacher(qc),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTeacher(id),
    onSuccess: () => invalidateAfterTeacher(qc),
  });
}
