#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use anyhow::bail;
use tauri::State;

use crate::core::error::FabaError;
use crate::dto::fababox::SlotDto;
use crate::faba::FabaBox;

mod mki;
mod faba;
mod core;
mod dto;

#[tauri::command]
fn load_slots(maybe_faba: State<Option<FabaBox>>) -> Result<Vec<SlotDto>, FabaError> {
    let Some(ref faba) = *maybe_faba else {
        return Err(FabaError::NotDetected)
    };
    let res = faba
        .list_slots()
        .into_iter()
        .map(From::from)
        .collect();
    Ok(res)
}

fn main() {
    tauri::Builder::default()
        .manage(FabaBox::detect())
        .invoke_handler(tauri::generate_handler![load_slots])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}