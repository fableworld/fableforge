import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import Button from '@mui/material/Button';
import { ThemeProvider } from "@emotion/react";
import { AppBar, Box, Container, createTheme, CssBaseline, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { red } from "@mui/material/colors";
import { SlotSelect } from "./components/SlotSelector";

const theme = createTheme({
  palette: {
    primary: {
      main: red[500],
    },
  },
});

interface SlotDto {
  index: number,
  name: string,
}

function App() {
  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [selectedSlot, selectSlot] = useState<string>('');

  async function loadSlots() {
    setSlots(await invoke("load_slots"));
  }

  const handleSlotChange = (event: SelectChangeEvent) => {
    selectSlot(event.target.value as string)
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Box
          component="main"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : theme.palette.grey[900],
            flexGrow: 1,
            height: '100vh',
            overflow: 'auto',
          }}
        >
          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <div>
              <Button variant="contained" onClick={loadSlots}>Hello World</Button>
            </div>
            <ul>

            </ul>
            <FormControl fullWidth>
              <InputLabel id="slot-select-label">Slot</InputLabel>
              <Select
                labelId="slot-select-label"
                id="slot-select"
                value={selectedSlot}
                label="Slot"
                onChange={handleSlotChange}
              >
                {slots.map(slot => <MenuItem key={slot.index} value={`${slot.index}`}>{slot.name}</MenuItem>)}
              </Select>
            </FormControl>
            <SlotSelect />
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
