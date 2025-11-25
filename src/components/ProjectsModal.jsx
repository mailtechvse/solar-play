import React, { useState, useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function ProjectsModal({ isOpen, onClose }) {
  const [projectName, setProjectName] = useState("Solar Project");
  const [action, setAction] = useState("list"); // 'list', 'save', 'load'
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const projects = useSolarStore((state) => state.projects);
  const currentProjectId = useSolarStore((state) => state.currentProjectId);
  const saveToSupabase = useSolarStore((state) => state.saveToSupabase);
  const loadFromSupabase = useSolarStore((state) => state.loadFromSupabase);
  const loadProjectsList = useSolarStore((state) => state.loadProjectsList);
  const deleteSupabaseProject = useSolarStore((state) => state.deleteSupabaseProject);
  const updateSupabaseProject = useSolarStore((state) => state.updateSupabaseProject);

  useEffect(() => {
    if (isOpen && action === "list") {
      loadProjects();
    }
  }, [isOpen, action]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      setMessage("");
      await loadProjectsList();
    } catch (error) {
      setMessage(`Error loading projects: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      if (currentProjectId) {
        // Update existing project
        await updateSupabaseProject(currentProjectId);
        setMessage("Project updated successfully!");
      } else {
        // Save new project
        await saveToSupabase(projectName);
        setMessage("Project saved successfully!");
      }

      setTimeout(() => {
        setAction("list");
      }, 1500);
    } catch (error) {
      setMessage(`Error saving project: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (project) => {
    try {
      setIsLoading(true);
      setMessage("");
      await loadFromSupabase(project.id);
      setMessage(`Loaded: ${project.name}`);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setMessage(`Error loading project: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (projectId) => {
    if (!confirm("Delete this project? This action cannot be undone.")) return;

    try {
      setIsLoading(true);
      setMessage("");
      await deleteSupabaseProject(projectId);
      setMessage("Project deleted");
      await loadProjects();
    } catch (error) {
      setMessage(`Error deleting project: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Project Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Action Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          {["list", "save", "load"].map((tab) => (
            <button
              key={tab}
              onClick={() => setAction(tab)}
              className={`px-4 py-2 font-semibold transition ${
                action === tab
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "list"
                ? "My Projects"
                : tab === "save"
                ? "Save New"
                : "Load Project"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded text-sm ${
                message.includes("Error")
                  ? "bg-red-900 text-red-200"
                  : "bg-green-900 text-green-200"
              }`}
            >
              {message}
            </div>
          )}

          {/* Save Tab */}
          {action === "save" && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="Enter project name..."
                />
              </div>
              <button
                onClick={handleSave}
                disabled={isLoading || !projectName.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-semibold transition"
              >
                {isLoading ? "Saving..." : currentProjectId ? "Update Project" : "Save Project"}
              </button>
            </div>
          )}

          {/* List Tab */}
          {action === "list" && (
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center text-gray-400 py-8">
                  <i className="fas fa-spinner fa-spin mr-2"></i> Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No projects yet. Create your first project!
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded hover:bg-gray-600 transition"
                    >
                      <div className="flex-1">
                        <p className="text-white font-semibold">{project.name}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(project.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoad(project)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                          title="Load project"
                        >
                          <i className="fas fa-download"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                          title="Delete project"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Load Tab Info */}
          {action === "load" && (
            <div className="text-gray-300 text-sm p-4 bg-gray-700 rounded">
              <p>
                <i className="fas fa-info-circle mr-2 text-blue-400"></i>
                Click the download button next to a project to load it into the canvas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
