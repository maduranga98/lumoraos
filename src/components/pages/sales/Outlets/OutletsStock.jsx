import React, { useState } from "react";
import OutletSelector from "./OutletSelector";

const OutletsStock = () => {
  const [selectedOutlet, setSelectedOutlet] = useState(null);

  return (
    <div>
      <OutletSelector
        selectedOutlet={selectedOutlet}
        onOutletSelect={setSelectedOutlet}
      />
      <div></div>
    </div>
  );
};

export default OutletsStock;
