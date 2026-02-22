use std::fs;
use std::fs::DirEntry;
use std::path::{Path, PathBuf};
use anyhow::bail;

use lazy_static::lazy_static;
use mountpoints::mountpaths;
use regex::Regex;

use crate::mki;
use crate::mki::encode_using_tempfile;

pub struct FabaBox {
    mountpoint: PathBuf,
}

const NUM_SLOTS: usize = 500;

lazy_static! {
    static ref TRACK_FILENAME_REGEX: Regex = Regex::new(r"^CP([0-9]{2})\.MKI$").unwrap();
}

impl FabaBox {
    pub fn mountpoint_str(&self) -> String {
        self.mountpoint.to_string_lossy().to_string()
    }

    pub fn mountpoint_path(&self) -> PathBuf {
        self.mountpoint.clone()
    }

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

    pub async fn write_track(&self, slot: usize, track: usize, source_path: impl AsRef<Path>) -> anyhow::Result<()> {
        let collection_path = self.build_collection_dir(slot);
        let track_path = collection_path.join(format!("CP{:02}.MKI", track + 1));
        if track > 0 && track_path.exists() {
            bail!("Track {track} already defined for collection {slot}!")
        }
        encode_using_tempfile(source_path, track_path, slot, track + 1).await?;
        Ok(())
    }

    fn build_collection_dir(&self, index: usize) -> PathBuf {
        self.mountpoint.join(format!("MKI01/K5{index:03}"))
    }

    pub fn list_slots(&self) -> Vec<FabaSlot> {
        (1..=NUM_SLOTS)
            .into_iter()
            .filter(|index| self.build_collection_dir(*index).is_dir())
            .map(|index| {
                let track_count = self.count_tracks(index);
                FabaSlot {
                    index,
                    name: None,
                    track_count,
                    exists: true,
                }
            })
            .collect()
    }

    pub fn list_all_slots(&self) -> Vec<FabaSlot> {
        (1..=NUM_SLOTS)
            .into_iter()
            .map(|index| {
                let dir = self.build_collection_dir(index);
                let exists = dir.is_dir();
                let track_count = if exists { self.count_tracks(index) } else { 0 };
                FabaSlot {
                    index,
                    name: None,
                    track_count,
                    exists,
                }
            })
            .collect()
    }

    pub fn clear_slot(&self, slot_idx: usize) -> anyhow::Result<()> {
        let dir = self.build_collection_dir(slot_idx);
        if dir.is_dir() {
            for entry in fs::read_dir(&dir)? {
                let entry = entry?;
                if entry.file_name().to_str()
                    .map(|n| n.ends_with(".MKI"))
                    .unwrap_or(false)
                {
                    fs::remove_file(entry.path())?;
                }
            }
        }
        Ok(())
    }

    fn count_tracks(&self, slot_idx: usize) -> usize {
        self.list_tracks(slot_idx)
            .map(|t| t.len())
            .unwrap_or(0)
    }

    pub fn list_tracks(&self, slot_idx: usize) -> anyhow::Result<Vec<Track>> {
        let entries = fs::read_dir(self.build_collection_dir(slot_idx))?;
        let result = entries.into_iter()
            .filter_map(|path_res| path_res.map(Self::detect_track).transpose())
            .collect::<Result<Vec<_>, _>>()?;
        Ok(result)
    }

    fn detect_track(path: DirEntry) -> Option<Track> {
        path.file_name().to_str()
            .and_then(|filename| TRACK_FILENAME_REGEX.captures(filename))
            .map(|cap| Track {
                index: cap[1].parse().expect("Error parsing value"),
            })
            .filter(|track| !Self::is_placeholder_track(track, &path))
    }

    fn is_placeholder_track(track: &Track, path: &DirEntry) -> bool {
        if track.index != 1 {
            false
        } else if Self::file_len(path.path()) != 18836 {
            false
        } else {
            true
        }
    }

    fn file_len(path: impl AsRef<Path>) -> u64 {
        path.as_ref()
            .metadata()
            .expect("Error extracting file metadata")
            .len()
    }
}

pub struct FabaSlot {
    pub index: usize,
    pub name: Option<String>,
    pub track_count: usize,
    pub exists: bool,
}

pub struct Track {
    pub index: usize,
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_track_filename_regex() {
        assert!(TRACK_FILENAME_REGEX.is_match("CP01.MKI"));
        assert!(TRACK_FILENAME_REGEX.is_match("CP99.MKI"));
        assert!(!TRACK_FILENAME_REGEX.is_match("CP100.MKI"));
        assert!(!TRACK_FILENAME_REGEX.is_match("CP01.mp3"));
        assert!(!TRACK_FILENAME_REGEX.is_match("invalid"));

        let caps = TRACK_FILENAME_REGEX.captures("CP05.MKI").unwrap();
        assert_eq!(&caps[1], "05");
    }

    #[test]
    fn test_build_collection_dir() {
        let faba = FabaBox {
            mountpoint: PathBuf::from("/mnt/faba")
        };
        assert_eq!(faba.build_collection_dir(1), PathBuf::from("/mnt/faba/MKI01/K5001"));
        assert_eq!(faba.build_collection_dir(99), PathBuf::from("/mnt/faba/MKI01/K5099"));
        assert_eq!(faba.build_collection_dir(500), PathBuf::from("/mnt/faba/MKI01/K5500"));
    }
}