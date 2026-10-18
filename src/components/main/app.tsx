import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { FileManager } from "../file-manager";
import { defaultExpandedLocations, defaultSelectedLocation, items, path, sections } from "./mock-data";

const appSx: SxProps<Theme> = {
    height: "100dvh",
};

const App = () => {
    return (
        <Box sx={appSx}>
            <FileManager
                sections={sections}
                items={items}
                path={path}
                defaultSelectedLocation={defaultSelectedLocation}
                defaultExpandedLocations={defaultExpandedLocations}
            />
        </Box>
    );
};

export default App;
