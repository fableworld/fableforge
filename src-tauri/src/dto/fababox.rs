use serde::Serialize;
use crate::faba::{FabaSlot, Track};

#[derive(Serialize)]
pub struct SlotDto {
    index: usize,
    name: String,
}

impl From<FabaSlot> for SlotDto {
    fn from(value: FabaSlot) -> Self {
        Self {
            index: value.index,
            name: value.name.unwrap_or_else(|| String::from("No name")),
        }
    }
}

#[derive(Serialize)]
pub struct TrackDto {
    track_number: usize,
}

impl From<Track> for TrackDto {
    fn from(value: Track) -> Self {
        Self {
            track_number: value.index,
        }
    }
}