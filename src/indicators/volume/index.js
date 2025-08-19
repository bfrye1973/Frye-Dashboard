import { INDICATOR_KIND } from "../shared/indicatorTypes";
import { volumeCompute } from "./compute";
import { volumeAttach } from "./overlay";
import { volumeDefaults } from "./schema";

const VOLUME = {
  id: "vol",
  label: "Volume",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: volumeDefaults,
  compute: (candles) => volumeCompute(candles),
  attach: volumeAttach,
};

export default VOLUME;
