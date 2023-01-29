#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use anyhow::bail;
use tauri::State;

use crate::core::error::FabaError;
use crate::dto::fababox::{SlotDto, TrackDto};
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

#[tauri::command]
fn load_tracks(maybe_faba: State<Option<FabaBox>>, slot: usize) -> Result<Vec<TrackDto>, FabaError> {
    let Some(ref faba) = *maybe_faba else {
        return Err(FabaError::NotDetected)
    };

    let res = faba
        .list_tracks(slot)
        .map_err(|_| FabaError::Communication)?
        .into_iter()
        .map(From::from)
        .collect();

    Ok(res)
}

fn main() {
    tauri::Builder::default()
        .manage(FabaBox::detect())
        .invoke_handler(tauri::generate_handler![load_slots, load_tracks])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}