import React from "react";
import Button from "./Button";

const CancelButton = ({
  children = "Cancel",
  onClick,
  className = "",
  ...props
}) => {
  return (
    <Button
      variant="secondary"
      onClick={onClick}
      className={`border border-gray-300 hover:border-gray-400 ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
};

export default CancelButton;
