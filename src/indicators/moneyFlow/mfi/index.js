import { INDICATOR_KIND } from "../../shared/indicatorTypes";
import { mfiCompute } from "./compute";
import { mfiAttach } from "./pane";
import { mfiDefaults } from "./schema";

const MFI = {
  id: "mfi",
  label: "Money Flow Index",
  kind: INDICATOR_KIND.SEPARATE,
  compute: mfiCompute,
  attach: mfiAttach,
  defaults: mfiDefaults,
};

export default MFI;

