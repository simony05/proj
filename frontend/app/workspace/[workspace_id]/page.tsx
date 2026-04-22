import WorkspaceView from "@/components/WorkspaceView";

interface Props {
  params: Promise<{ workspace_id: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { workspace_id } = await params;
  return <WorkspaceView key={workspace_id} workspaceId={workspace_id} />;
}
