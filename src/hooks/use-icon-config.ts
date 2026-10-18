import { useContext } from "react";

import { IconContext } from "../contexts/icon-context";

import type { IconConfig } from "../contexts/icon-context";

export const useIconConfig = (): IconConfig => useContext(IconContext);
