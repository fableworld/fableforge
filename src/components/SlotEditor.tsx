import { Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText } from "@mui/material";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { selectedSlotAtom } from "../atoms/slot";
import DeleteIcon from '@mui/icons-material/Delete';
import PlayIcon from '@mui/icons-material/PlayCircleFilled';

type NewTrack = {
    t: 'new',
    sourcePath: string,
}

type LoadedTrack = {
    t: 'loaded',
}

const LoadedTrackItem = ({ track }: { track: LoadedTrack }) => <>
    <ListItem>
        <ListItemAvatar>
            <Avatar>
                <PlayIcon />
            </Avatar>
        </ListItemAvatar>
        <ListItemText
            primary="BLA"
        />
    </ListItem>
</>;

const NewTrackItem = ({ track }: { track: NewTrack }) => <>
    <ListItem
        secondaryAction={<IconButton edge="end" aria-label="remove"><DeleteIcon /></IconButton>}
    >
        <ListItemAvatar>
            <Avatar>
                <PlayIcon />
            </Avatar>
        </ListItemAvatar>
        <ListItemText
            primary="BLA"
            secondary={track.sourcePath}
        />

    </ListItem>
</>;

export const SlotEditor = () => {
    const [tracks, setTracks] = useState<Array<NewTrack | LoadedTrack>>([]);
    const [slot, _] = useAtom(selectedSlotAtom);
    useEffect(() => {
        if (slot) {
            setTracks([{ t: 'loaded' }, { t: 'new', sourcePath: '/some/test/path' }]);
        } else {
            setTracks([]);
        }
    }, [slot?.index]);

    if (!slot) {
        return <></>;
    }

    return <List>
        {tracks.map((track, idx) => {
            switch (track.t) {
                case 'loaded':
                    return <LoadedTrackItem key={idx} track={track} />
                case 'new':
                    return <NewTrackItem key={idx} track={track} />
            }
        })}
    </List>;
}