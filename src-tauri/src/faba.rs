use std::fs;
use std::path::PathBuf;
use anyhow::anyhow;
use mountpoints::mountpaths;
use crate::mki;

pub struct FabaBox {
    mountpoint: PathBuf,
}

const NUM_SLOTS: usize = 500;

impl FabaBox {
    pub fn detect() -> Option<Self> {
        // TODO: find a way to extract mountpoint from device
        // let devices = usb_enumeration::enumerate(Some(58807), Some(2065));

        mountpaths()
            .unwrap_or_default()
            .into_iter()
            .find(|base| base.join("MKI01").is_dir())
            .map(|mountpoint| Self { mountpoint })
    }

    pub fn initialize_freefaba_fs(&self) -> anyhow::Result<()> {
        for idx in 1..=NUM_SLOTS {
            let collection_path = self.build_collection_dir(idx);
            let first_track_path = collection_path.join("CP01.MKI");
            if !collection_path.exists() {
                fs::create_dir(collection_path)?;
            }
            if !first_track_path.exists() {
                mki::encode_bytes_using_tempfile(include_bytes!("../res/audio/not-found.mp3"), first_track_path, 5000+idx, 1)?;
            }
        }
        Ok(())
    }

    fn build_collection_dir(&self, index: usize) -> PathBuf {
        self.mountpoint.join(format!("MKI01/K5{index:03}"))
    }

    pub fn list_slots(&self) -> Vec<FabaSlot> {
        (1..=NUM_SLOTS)
            .into_iter()
            .filter(|index| self.build_collection_dir(*index).is_dir())
            .map(|index| FabaSlot {
                index,
                name: None,
            })
            .collect()
    }
}

pub struct FabaSlot {
    pub index: usize,
    pub name: Option<String>,
}