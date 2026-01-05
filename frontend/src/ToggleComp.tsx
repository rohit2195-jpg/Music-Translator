
interface MyProp {
  isStandard: boolean;
  setIsStandard: any;
  disabled: boolean;
}


const ToggleButton = ({isStandard, setIsStandard, disabled}: MyProp) => {

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
