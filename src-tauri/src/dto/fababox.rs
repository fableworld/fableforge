use serde::Serialize;
use crate::faba::FabaSlot;

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