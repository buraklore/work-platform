export const qk = {
  me: ["me"] as const,
  projects: (wsId: string) => ["projects", wsId] as const,
  project: (id: string) => ["project", id] as const,
  projectTasks: (id: string) => ["project-tasks", id] as const,
  myTasks: (wsId: string) => ["my-tasks", wsId] as const,
  task: (id: string) => ["task", id] as const,
  members: (wsId: string) => ["members", wsId] as const,
  labels: (wsId: string) => ["labels", wsId] as const,
  usage: (wsId: string) => ["usage", wsId] as const,
  inviteLinks: (wsId: string) => ["invite-links", wsId] as const,
  search: (wsId: string, q: string) => ["search", wsId, q] as const,
};
