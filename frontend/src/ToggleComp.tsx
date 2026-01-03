import React, { useState } from 'react';

const ToggleButton = ({isStandard, setIsStandard, disabled}) => {

  const handleToggle = () => {
    setIsStandard(!isStandard);
  };

  if (disabled) return;


  return (
    <div>
      <p>{isStandard ? 'Standard' : 'Advanced'} Translation</p>
      <button onClick={handleToggle}>
        {isStandard ? 'Switch model' : 'Switch model'}
      </button>
    </div>
  );
};

export default ToggleButton;
