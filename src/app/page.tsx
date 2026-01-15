"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectApi } from "@/lib/api";
import { ProjectList } from "@/components/project-list";
import type { Project } from "@/lib/api-types";
import { AUTH_EVENT_NAME, AUTH_STORAGE_KEY, loadAuthState } from "@/lib/auth";
import { EVENTS } from "@/lib/events";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  const refreshProjects = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await projectApi.getAll();
      setProjects(res.projectList);
    } catch (error) {
      console.error("Failed to fetch projects", error);
      setErrorMessage("Failed to load projects. Check the backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const auth = loadAuthState();
      if (!auth) {
        setIsAuthed(false);
        setProjects([]);
        setIsLoading(false);
        return;
      }

      setIsAuthed(true);
      refreshProjects();
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === AUTH_STORAGE_KEY) {
        handleAuthChange();
      }
    };

    handleAuthChange();
    const handleRefresh = () => refreshProjects();
    window.addEventListener(AUTH_EVENT_NAME, handleAuthChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(EVENTS.REFRESH_PROJECTS, handleRefresh);

    return () => {
      window.removeEventListener(AUTH_EVENT_NAME, handleAuthChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EVENTS.REFRESH_PROJECTS, handleRefresh);
    };
  }, []);

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
      {!isAuthed && !isLoading && (
        <div className="mb-6 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You need to log in to view your projects.{" "}
          <Link className="text-primary hover:underline" href="/auth/login">
            Go to login
          </Link>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading projects...</div>
      ) : (
        <ProjectList projects={projects} />
      )}
    </main>
  );
}
