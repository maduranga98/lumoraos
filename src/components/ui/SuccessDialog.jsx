import React from "react";
import { Check } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

const SuccessDialog = ({
  isOpen,
  onClose,
  title = "Success!",
  message,
  buttonText = "Continue",
  onConfirm,
  showSecondaryButton = false,
  secondaryButtonText = "Close",
  onSecondaryAction,
}) => {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-500 mb-6">{message}</p>}
        {showSecondaryButton ? (
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={handleSecondaryAction}
              className="flex-1"
            >
              {secondaryButtonText}
            </Button>
            <Button
              variant="success"
              onClick={handleConfirm}
              className="flex-1"
            >
              {buttonText}
            </Button>
          </div>
        ) : (
          <Button variant="success" onClick={handleConfirm} className="w-full">
            {buttonText}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default SuccessDialog;
