import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { patchEverywhere, removeEverywhere, restore, snapshot } from "@/features/tasks/cache";
import type { MyTaskItem, MyTasks, TaskDetail, TaskItem } from "@/features/tasks/types";

const base: TaskItem = {
  id: "t1", projectId: "p1", statusId: "s1", statusCategory: "todo", parentTaskId: null, title: "Rapor",
  priority: "normal", dueDate: null, dueTime: null, position: "a0", completedAt: null, createdAt: "2026-10-01T00:00:00Z",
  assigneeIds: [], labelIds: [], subtaskCount: 0, subtaskDoneCount: 0, checklistCount: 0, checklistDoneCount: 0,
};
const mine: MyTaskItem = { ...base, projectName: "Web", projectColor: "#000000", isPersonalProject: false };

describe("optimistic task cache", () => {
  it("does not cancel a first load (it would stay pending forever)", async () => {
    const qc = new QueryClient();
    let resolve!: (v: TaskDetail) => void;
    const first = qc.fetchQuery({ queryKey: ["task", "t9"], queryFn: () => new Promise<TaskDetail>((r) => (resolve = r)) });
    await snapshot(qc);
    resolve({ ...base, id: "t9" } as unknown as TaskDetail);
    await first;
    expect(qc.getQueryState(["task", "t9"])!.status).toBe("success");
  });

  it("completing moves a task from open to completed in My Tasks, and back", () => {
    const qc = new QueryClient();
    qc.setQueryData<MyTasks>(["my-tasks", "w1"], { open: [mine], completed: [] });
    patchEverywhere(qc, "t1", { completedAt: "2026-10-01T10:00:00Z", statusCategory: "done" });
    expect(qc.getQueryData<MyTasks>(["my-tasks", "w1"])!.completed.map((t) => t.id)).toEqual(["t1"]);
    patchEverywhere(qc, "t1", { completedAt: null, statusCategory: "todo" });
    expect(qc.getQueryData<MyTasks>(["my-tasks", "w1"])!.open.map((t) => t.id)).toEqual(["t1"]);
  });

  it("moving between projects removes the row from the old project list", () => {
    const qc = new QueryClient();
    qc.setQueryData<TaskItem[]>(["project-tasks", "p1"], [base]);
    patchEverywhere(qc, "t1", { projectId: "p2" }, { removeFromProject: "p1" });
    expect(qc.getQueryData<TaskItem[]>(["project-tasks", "p1"])).toEqual([]);
  });

  it("patches subtasks inside the parent's detail and removes them on delete", () => {
    const qc = new QueryClient();
    const sub = { ...base, id: "s1", parentTaskId: "t1" };
    qc.setQueryData(["task", "t1"], { ...base, subtasks: [sub], subtaskCount: 1 });
    patchEverywhere(qc, "s1", { title: "Yeni" });
    expect(qc.getQueryData<TaskDetail>(["task", "t1"])!.subtasks[0]!.title).toBe("Yeni");
    removeEverywhere(qc, "s1");
    const parent = qc.getQueryData<TaskDetail>(["task", "t1"])!;
    expect(parent.subtasks).toEqual([]);
    expect(parent.subtaskCount).toBe(0);
  });

  it("restore puts every cache back after a failed write", async () => {
    const qc = new QueryClient();
    qc.setQueryData<TaskItem[]>(["project-tasks", "p1"], [base]);
    const snap = await snapshot(qc);
    patchEverywhere(qc, "t1", { title: "Bozuk" });
    restore(qc, snap);
    expect(qc.getQueryData<TaskItem[]>(["project-tasks", "p1"])![0]!.title).toBe("Rapor");
  });
});
