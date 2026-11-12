import "./styles/theme.css";

import { rtl } from "./options";

// `?rtl` sets only `dir="rtl"` on `<html>`, which is all the file manager asks of a page.
if (rtl) {
    document.documentElement.dir = "rtl";
}
