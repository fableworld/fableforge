use tauri::{AppHandle, Manager, State};

use crate::core::error::FabaError;
use crate::dto::fababox::{SlotDto, TrackDto, NewTrackDto};
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

#[tauri::command]
async fn write_tracks<'a>(maybe_faba: State<'a, Option<FabaBox>>, slot: usize, new_tracks: Vec<NewTrackDto>) -> Result<(), FabaError> {
    let Some(ref faba) = *maybe_faba else {
        return Err(FabaError::NotDetected)
    };

    for track in new_tracks {
        faba.write_track(slot, track.track_number, track.path)
            .await
            .map_err(|err| {
                eprintln!("Write error - {err}");
                FabaError::Communication
            })?;
    }
    Ok(())
}

#[tauri::command]
async fn copy_audio_file(
    app: AppHandle,
    src: String,
    collection_id: String,
    filename: String,
) -> Result<String, FabaError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| FabaError::Communication)?;
    let dest_dir = app_data
        .join("collections")
        .join(&collection_id)
        .join("tracks");
    std::fs::create_dir_all(&dest_dir).map_err(|_| FabaError::Communication)?;

    let dest = dest_dir.join(&filename);
    std::fs::copy(&src, &dest).map_err(|_| FabaError::Communication)?;

    Ok(dest.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(FabaBox::detect())
        .invoke_handler(tauri::generate_handler![load_slots, load_tracks, write_tracks, copy_audio_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
