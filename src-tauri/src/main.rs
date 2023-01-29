#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use anyhow::bail;
use tauri::State;

use crate::core::error::FabaError;
use crate::faba::FabaBox;

mod mki;
mod faba;
mod core;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(maybe_faba: State<Option<FabaBox>>, input_file: &str) -> Result<String, FabaError> {
    let Some(ref faba) = *maybe_faba else {
        return Err(FabaError::NotDetected)
    };
    Ok(format!("Input file: {}", input_file))
}

fn main() {
    tauri::Builder::default()
        .manage(FabaBox::detect())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}