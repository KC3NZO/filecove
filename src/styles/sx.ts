import type { SxProps, Theme } from "@mui/material/styles";

type SxArray = Extract<SxProps<Theme>, ReadonlyArray<unknown>>;

/** A style object, which an `sx` array can hold, unlike another `sx`, which may be an array itself. */
type SxObject = Exclude<SxProps<Theme>, SxArray>;

const isSxArray = (sx: SxProps<Theme>): sx is SxArray => Array.isArray(sx);

/** `base`, then the `sx` a consumer passed over it, so theirs wins where the two differ. */
export const withSx = (base: SxObject, sx: SxProps<Theme> | undefined): SxProps<Theme> => {
    if (!sx) {
        return base;
    }

    return isSxArray(sx) ? [base, ...sx] : [base, sx];
};
