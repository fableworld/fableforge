use std::path::PathBuf;
use anyhow::anyhow;
use mountpoints::mountpaths;

pub struct FabaBox {
    mountpoint: PathBuf,
}

impl FabaBox {
    pub fn detect() -> anyhow::Result<Self> {
        // TODO: find a way to extract mountpoint from device
        // let devices = usb_enumeration::enumerate(Some(58807), Some(2065));

        let mountpoint = mountpaths()?
            .into_iter()
            .find(|base| base.join("MKI01").is_dir())
            .ok_or_else(|| anyhow!("MyFaba device not found"))?;

        Ok(Self { mountpoint })
    }
}