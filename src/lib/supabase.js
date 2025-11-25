import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Equipment queries
export const equipmentService = {
  // Get all equipment types
  async getEquipmentTypes() {
    const { data, error } = await supabase
      .from("equipment_types")
      .select("*")
      .order("name");
    if (error) throw error;
    return data;
  },

  // Get equipment by type
  async getEquipmentByType(typeId) {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        `
        *,
        equipment_types:type_id (*)
      `
      )
      .eq("type_id", typeId)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data;
  },

  // Get all active equipment
  async getAllEquipment() {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        `
        *,
        equipment_types:type_id (*)
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  // Get single equipment
  async getEquipment(id) {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        `
        *,
        equipment_types:type_id (*),
        spec_sheets (*)
      `
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  // Create equipment
  async createEquipment(equipment) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("equipment")
      .insert([
        {
          ...equipment,
          created_by: user?.id,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update equipment
  async updateEquipment(id, updates) {
    const { data, error } = await supabase
      .from("equipment")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Delete equipment
  async deleteEquipment(id) {
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (error) throw error;
  },

  // Get presets
  async getPresets(category) {
    let query = supabase.from("equipment_presets").select("*");
    if (category) {
      query = query.eq("category", category);
    }
    const { data, error } = await query.order("name");
    if (error) throw error;
    return data;
  },

  // Create preset
  async createPreset(preset) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("equipment_presets")
      .insert([
        {
          ...preset,
          created_by: user?.id,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// Spec sheet queries
export const specSheetService = {
  // Create spec sheet record
  async createSpecSheet(specSheet) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("spec_sheets")
      .insert([
        {
          ...specSheet,
          created_by: user?.id,
          extraction_status: "pending",
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Get spec sheets for equipment
  async getSpecSheets(equipmentId) {
    const { data, error } = await supabase
      .from("spec_sheets")
      .select("*")
      .eq("equipment_id", equipmentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  // Update spec sheet
  async updateSpecSheet(id, updates) {
    const { data, error } = await supabase
      .from("spec_sheets")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Analyze spec sheet with Gemini
  async analyzeSpecSheet(
    specSheetId,
    equipmentType,
    fileContent,
    fileType,
    equipmentId
  ) {
    const { data, error } = await supabase.functions.invoke(
      "analyze-spec-sheet",
      {
        body: {
          spec_sheet_id: specSheetId,
          equipment_type: equipmentType,
          file_content: fileContent,
          file_type: fileType,
          equipment_id: equipmentId,
        },
      }
    );

    if (error) throw error;
    return data;
  },
};

// Project management queries
export const projectService = {
  // Save project to Supabase
  async saveProject(projectName, projectData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          user_id: user.id,
          name: projectName,
          canvas_data: projectData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update existing project
  async updateProject(projectId, projectData) {
    const { data, error } = await supabase
      .from("projects")
      .update({
        canvas_data: projectData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Load project from Supabase
  async loadProject(projectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) throw error;
    return data;
  },

  // List user's projects
  async listUserProjects(limit = 50) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Delete project
  async deleteProject(projectId) {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) throw error;
  },

  // Search projects by name
  async searchProjects(searchTerm) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const { data, error } = supabase
      .from("projects")
      .select("id, name, created_at, updated_at")
      .eq("user_id", user.id)
      .ilike("name", `%${searchTerm}%`)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data;
  },
};
