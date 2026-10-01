export type SearchResults = {
  tasks: Array<{ id: string; title: string; projectId: string; projectName: string; projectColor: string; completed: boolean }>;
  projects: Array<{ id: string; name: string; color: string; isPersonal: boolean }>;
  people: Array<{ userId: string; fullName: string; email: string; avatarUrl: string | null }>;
};
