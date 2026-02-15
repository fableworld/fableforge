use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use crate::faba::{FabaSlot, Track};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotDto {
    pub index: usize,
    pub name: String,
    pub character_name: Option<String>,
    pub track_count: usize,
    pub exists: bool,
}


impl From<FabaSlot> for SlotDto {
    fn from(value: FabaSlot) -> Self {
        Self {
            index: value.index,
            name: value.name.clone().unwrap_or_else(|| String::from("No name")),
            character_name: value.name,
            track_count: value.track_count,
            exists: value.exists,
        }
    }
}


#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackDto {
    pub track_number: usize,
}

impl From<Track> for TrackDto {
    fn from(value: Track) -> Self {
        Self {
            track_number: value.index,
        }
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NewTrackDto {
    pub track_number: usize,
    pub path: PathBuf,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceStatusDto {
    pub connected: bool,
    pub mountpoint: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WriteProgressDto {
    pub current: usize,
    pub total: usize,
    pub track_name: String,
    pub status: String,
}