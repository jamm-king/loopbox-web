import { projectApi } from "@/lib/api";
import { ProjectList } from "@/components/project-list";
import type { Project } from "@/lib/api-types";

export default async function Home() {
  let projects: Project[] = [];
  let errorMessage: string | null = null;

  try {
    const res = await projectApi.getAll();
    projects = res.projectList;
  } catch (e) {
    console.error("Failed to fetch projects", e);
    errorMessage = "Failed to load projects. Check the backend connection.";
  }

  return (
    <main className="flex min-h-screen flex-col p-8 md:p-24">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your music generation projects.
          </p>
        </div>
      </div>
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}
      <ProjectList projects={projects} />
    </main>
  );
}
