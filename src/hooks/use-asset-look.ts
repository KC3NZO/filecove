import { useContext, useLayoutEffect } from "react";

import { AssetLookContext } from "../contexts/asset-look-context";

/**
 * Says that the media manager's own look is drawn here, however deep in what an app's `renderAsset`
 * returns, before anything is painted, so the asset around it leaves showing why it can't be chosen
 * to it.
 */
export const useAssetLook = () => {
    const claim = useContext(AssetLookContext);

    useLayoutEffect(() => claim?.(), [claim]);
};
