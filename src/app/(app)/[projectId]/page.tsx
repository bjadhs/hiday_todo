import { TodoList } from "@/components/todo-list"

export default async function ProjectPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params
  return <TodoList projectId={projectId} />
}
