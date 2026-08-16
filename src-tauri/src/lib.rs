mod commands;
mod models;

use models::ollama::OllamaState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(OllamaState::new())
        .invoke_handler(tauri::generate_handler![
            commands::ollama::check_ollama,
            commands::ollama::list_ollama_models,
            commands::ollama::generate_diagram,
            commands::ollama::repair_diagram,
            commands::ollama::cancel_generation,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the OpenVisual Local window");
}
