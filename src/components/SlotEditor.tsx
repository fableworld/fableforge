import { Avatar, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText } from "@mui/material";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { selectedSlotAtom } from "../atoms/slot";
import DeleteIcon from '@mui/icons-material/Delete';
import PlayIcon from '@mui/icons-material/PlayCircleFilled';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import { invoke } from "@tauri-apps/api";
import { open } from '@tauri-apps/api/dialog';

type NewTrack = {
    t: 'new',
    sourcePath: string,
}

type LoadedTrack = {
    t: 'loaded',
    trackNumber: number,
}

const LoadedTrackItem = ({ track, trackNum }: { track: LoadedTrack, trackNum: number }) => <>
    <ListItem>
        <ListItemAvatar>
            <Avatar>
                <PlayIcon />
            </Avatar>
        </ListItemAvatar>
        <ListItemText
            primary={`Track ${trackNum}`}
        />
    </ListItem>
</>;

const NewTrackItem = ({ track, trackNum, onDelete }: { track: NewTrack, trackNum: number, onDelete: React.MouseEventHandler<HTMLButtonElement> }) => <>
    <ListItem
        secondaryAction={<IconButton onClick={onDelete} edge="end" aria-label="remove"><DeleteIcon /></IconButton>}
    >
        <ListItemAvatar>
            <Avatar>
                <PlayIcon />
            </Avatar>
        </ListItemAvatar>
        <ListItemText
            primary={`Track ${trackNum}`}
            secondary={track.sourcePath}
        />

    </ListItem>
</>;

export const SlotEditor = () => {
    const [tracks, setTracks] = useState<Array<NewTrack | LoadedTrack>>([]);
    const [slot, _] = useAtom(selectedSlotAtom);

    const reloadTracks = async () => {
        if (slot) {
            const tracks = await invoke('load_tracks', { slot: slot.index }) as { trackNumber: number }[];
            setTracks(tracks.map(track => ({ t: 'loaded', ...track })));
        }
    };

    useEffect(() => {
        setTracks([]);
        if (slot) {
            reloadTracks();
        }
    }, [slot?.index]);

    if (!slot) {
        return <></>;
    }

    const addTrack = async () => {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Track',
                extensions: ['mp3']
            }]
        });

        if (Array.isArray(selected)) {
            // user selected multiple files
        } else if (selected === null) {
            // user cancelled the selection
        } else {
            // user selected a single file
            setTracks([...tracks, { t: 'new', sourcePath: selected }]);
        }
    };

    const writeTracks = async () => {
        const newTracks = tracks
            .map((track, trackNum) => ({ ...track, trackNum }))
            .filter(track => track.t === 'new')
            .map(track => ({ path: (track as NewTrack).sourcePath, trackNumber: track.trackNum }));

        console.log(newTracks);
        
        await invoke('write_tracks', { slot: slot.index, newTracks });
        await reloadTracks();
    }

    const onDelete = (trackNum: number) => {
        const updatedTracks = tracks.slice();
        updatedTracks.splice(trackNum, 1);
        setTracks(updatedTracks);
    }

    return <>
        <List>
            {tracks.map((track, idx) => {
                switch (track.t) {
                    case 'loaded':
                        return <LoadedTrackItem key={idx} track={track} trackNum={idx + 1} />
                    case 'new':
                        return <NewTrackItem key={idx} track={track} trackNum={idx + 1} onDelete={() => onDelete(idx)} />
                }
            })}
        </List>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addTrack}>Add track</Button>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={writeTracks}>Write</Button>
    </>;
}